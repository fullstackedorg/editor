//
//  InstanceEditor.swift
//  FullStacked
//
//  Created by Charles-Philippe Lepage on 2024-03-22.
//

import Foundation
import SwiftyJSON
import UIKit

let paths = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true);
let documentsDirectory = paths.first!

class InstanceEditor: Instance {
    static var singleton: InstanceEditor?
    
    init(){
        let editorDirectory = Bundle.main.path(forResource: "build", ofType: nil)!
        super.init(adapter: AdapterEditor(baseDirectory: editorDirectory))
        self.webview.isOpaque = false
        InstanceEditor.singleton = self
    }
}

class AdapterEditor: Adapter {
    let rootDirectory = documentsDirectory
    private let baseJS = Bundle.main.path(forResource: "index", ofType: "js", inDirectory: "js")!
    let cacheDirectory = FileManager.default.temporaryDirectory.absoluteString
    let configDirectory = ".config/fullstacked"
    let nodeModulesDirectory: String
    let fsEditor: AdapterFS
    let bonjour = Bonjour()
    let multipeer = Multipeer()
    
    override init(baseDirectory: String) {
        self.nodeModulesDirectory = configDirectory + "/node_modules"
        self.fsEditor = AdapterFS(baseDirectory: self.rootDirectory);
        super.init(baseDirectory: baseDirectory)
        
        
        self.bonjour.onPeerNearby = {eventType, peerNearbyBonjour in
            let message = [
                "eventType": eventType,
                "peerNearby": [
                    "type": 1,
                    "peer": [
                        "id": peerNearbyBonjour.id,
                        "name": peerNearbyBonjour.name
                    ],
                    "addresses": peerNearbyBonjour.addresses,
                    "port": peerNearbyBonjour.port
                ]
            ]
            InstanceEditor.singleton?.push(messageType: "peerNearby", message: JSON(message).rawString()!)
        }
        self.multipeer.onPeerNearby = {eventType, peerNearbyMultipeer in
            let message = [
                "eventType": eventType,
                "peerNearby": [
                    "type": 2,
                    "peer": [
                        "id": peerNearbyMultipeer.peer.id,
                        "name": peerNearbyMultipeer.peer.name
                    ],
                    "id": peerNearbyMultipeer.id
                ]
            ]
            InstanceEditor.singleton?.push(messageType: "peerNearby", message: JSON(message).rawString()!)
        }
        
        self.multipeer.onOpenConnection = {id in
            let message = ["id": id, "type": 3]
            InstanceEditor.singleton?.push(messageType: "openConnection", message: JSON(message).rawString()!)
        }
        self.multipeer.onPeerConnectionRequest = {id, peerConnectionRequestStr in
            let message = [
                "id": id,
                "type": 3,
                "peerConnectionRequestStr": peerConnectionRequestStr
            ]
            InstanceEditor.singleton?.push(messageType: "peerConnectionRequest", message: JSON(message).rawString()!)
        }
        self.multipeer.onPeerConnectionResponse = {id, peerConnectionResponseStr in
            let message = [
                "id": id,
                "type": 3,
                "peerConnectionResponseStr": peerConnectionResponseStr
            ]
            InstanceEditor.singleton?.push(messageType: "peerConnectionResponse", message: JSON(message).rawString()!)
        }
        self.multipeer.onPeerConnectionLost = {id in
            let message = ["id": id]
            InstanceEditor.singleton?.push(messageType: "peerConnectionLost", message: JSON(message).rawString()!)
        }
        
        self.multipeer.onPeerData = {id, data in
            let message = [
                "id": id,
                "data": data
            ]
            InstanceEditor.singleton?.push(messageType: "peerData", message: JSON(message).rawString()!)
        }
    }
    
    override func callAdapterMethod(methodPath: [String.SubSequence], body: Data, done: @escaping (_ maybeData: Any?) -> Void) {
        if(methodPath.count == 0) {
            return done(nil)
        }
        
        let json = try! JSON(data: body)
        
        let writeFile = { (path: String, data: Data, recursive: Bool) in
            if(recursive) {
                let directory = path.split(separator: "/").dropLast()
                self.fsEditor.mkdir(path: directory.joined(separator: "/"))
            }
            
            return self.fsEditor.writeFile(file: path, data: data)
        }
        
        switch(methodPath.first) {
            case "directories":
                switch(methodPath[1]) {
                    case "root": return done(self.rootDirectory)
                    case "cache": return done(self.cacheDirectory)
                    case "config": return done(self.configDirectory)
                    case "nodeModules": return done(self.nodeModulesDirectory)
                    default: break
                }
                break
            case "fs":
                if (json[1]["absolutePath"].boolValue || json[2]["absolutePath"].boolValue) {
                    switch(methodPath[1]){
                        case "readFile": return done(self.fsEditor.readFile(path: json[0].stringValue, utf8: json[1]["encoding"].stringValue == "utf8"))
                        case "writeFile":
                            var data: Data;
                            
                            if(json[1]["type"].stringValue == "Uint8Array") {
                                let uint8array = json[1]["data"].arrayValue.map({ number in
                                    return number.uInt8!
                                })
                                data = Data(uint8array)
                            } else {
                                data = json[1].stringValue.data(using: .utf8)!
                            }
                        
                            return done(writeFile(json[0].stringValue, data, json[2]["recursive"].boolValue))
                        case "writeFileMulti":
                            for fileJSON in json[0].arrayValue {
                                var data: Data;
                                
                                if(fileJSON["data"]["type"].stringValue == "Uint8Array") {
                                    let uint8array = fileJSON["data"]["data"].arrayValue.map({ number in
                                        return number.uInt8!
                                    })
                                    data = Data(uint8array)
                                } else {
                                    data = fileJSON["data"].stringValue.data(using: .utf8)!
                                }
                                
                                let maybeError = writeFile(fileJSON["path"].stringValue, data, json[1]["recursive"].boolValue)
                                if(maybeError is AdapterError){
                                    return done(maybeError)
                                }
                            }
                            return done(true)
                        case "unlink": return done(self.fsEditor.unlink(path: json[0].stringValue))
                        case "readdir": return done(self.fsEditor.readdir(path: json[0].stringValue, withFileTypes: json[1]["withFileTypes"].boolValue, recursive: json[1]["recursive"].boolValue))
                        case "mkdir": return done(self.fsEditor.mkdir(path: json[0].stringValue))
                        case "rmdir": return done(self.fsEditor.rmdir(path: json[0].stringValue))
                        case "stat": return done(self.fsEditor.stat(path: json[0].stringValue))
                        case "lstat": return done(self.fsEditor.lstat(path: json[0].stringValue))
                        case "exists":
                            let exists = self.fsEditor.exists(path: json[0].stringValue)
                            return done(exists == nil ? false : exists)
                        default: break;
                    }
                }
                break
            case "esbuild":
                switch(methodPath[1]) {
                    case "check": return done("1")
                    case "install": break
                    default: break
                }
                break
            case "build":
                let project = json[0]
                
                let entryPoint = [
                    self.rootDirectory + "/" + project["location"].stringValue + "/index.js",
                    self.rootDirectory + "/" + project["location"].stringValue + "/index.jsx",
                    self.rootDirectory + "/" + project["location"].stringValue + "/index.ts",
                    self.rootDirectory + "/" + project["location"].stringValue + "/index.tsx"
                ].first { file in
                    if let existsAndIsDirectory = AdapterFS.itemExistsAndIsDirectory(file) {
                        return !existsAndIsDirectory
                    }
                    return false
                }
            
                if(entryPoint == nil){
                    return done(true)
                }
                
                let mergedFile = self.merge(entryPoint: entryPoint!)
            
                let outdir = self.rootDirectory + "/" + project["location"].stringValue + "/.build"
                
                let inputPtr = UnsafeMutablePointer<Int8>(mutating: (String(mergedFile.dropFirst("file://".count)) as NSString).utf8String)
                let outPtr = UnsafeMutablePointer<Int8>(mutating: ("index" as NSString).utf8String)
                let outdirPtr = UnsafeMutablePointer<Int8>(mutating: (outdir as NSString).utf8String)
                let nodePathPtr = UnsafeMutablePointer<Int8>(mutating: (self.rootDirectory + "/" + self.nodeModulesDirectory as NSString).utf8String)
                
                var errorsPtr = UnsafeMutablePointer<Int8>(nil)
                
                build(inputPtr,
                      outPtr,
                      outdirPtr,
                      nodePathPtr,
                      &errorsPtr)
                
                try! FileManager.default.removeItem(at: URL(string: mergedFile)!)
            
                if(errorsPtr != nil) {
                    let errorsJSONStr = String.init(cString: errorsPtr!, encoding: .utf8)!
                    return done(JSON(parseJSON: errorsJSONStr))
                }
            
                return done(true)
            case "run":
                let projectDirectory = self.rootDirectory + "/" + json[0]["location"].stringValue
                    
                let runningInstance = RunningInstances.singleton?.getInstance(projectDirectory: projectDirectory)
            
                if(runningInstance != nil) {
                    runningInstance!.webview.reload()
                } else {
                    let project = Project(location: projectDirectory,
                                              title: json[0]["title"].stringValue)
                    RunningInstances.singleton?.addInstance(instance: Instance(project: project))
                }
            
                return done(true)
            case "open": 
                let projectLocation = self.rootDirectory + "/" + json[0]["location"].stringValue
                UIApplication.shared.open(URL(string: "shareddocuments://" + projectLocation)!)
                return done(true)
            case "connectivity":
                switch(methodPath[1]) {
                case "infos":
                    return done(false)
                case "name":
                    return done(UIDevice.current.name)
                case "peers":
                    switch(methodPath[2]){
                    case "nearby":
                        var peersNearby: [JSON] = []
                        let peersNearbyBonjour = self.bonjour.getPeersNearby().arrayValue
                        let peersNearbyMultipeer = self.multipeer.getPeersNearby().arrayValue
                        
                        for peerNearby in peersNearbyBonjour {
                            peersNearby.append(peerNearby)
                        }
                        for peerNearby in peersNearbyMultipeer {
                            peersNearby.append(peerNearby)
                        }
                        
                        return done(JSON(peersNearby))
                    default: break
                    }
                case "advertise": 
                    switch(methodPath[2]){
                    case "start": 
                        self.multipeer.startAdvertising(id: json[0]["id"].stringValue, name: json[0]["name"].stringValue)
                        return done(true)
                    case "stop": 
                        self.multipeer.stopAdvertising()
                        return done(true)
                    default: break
                    }
                case "browse": 
                    switch(methodPath[2]){
                    case "start":
                        self.bonjour.startBrowsing()
                        self.multipeer.startBrowsing()
                        return done(true)
                    case "stop":
                        self.bonjour.stopBrowsing()
                        self.multipeer.stopBrowsing()
                        return done(true)
                    default: break
                    }
                case "open":
                    self.multipeer.open(id: json[0].stringValue, meId: json[1]["id"].stringValue, meName: json[1]["name"].stringValue)
                    return done(true)
                case "disconnect":
                    self.multipeer.disconnect(id: json[0].stringValue)
                    return done(true)
                case "requestConnection":
                    self.multipeer.requestConnection(id: json[0].stringValue, peerConnectionRequestStr: json[1].stringValue)
                    return done(true)
                case "respondToRequestConnection":
                    self.multipeer.respondToConnectionRequest(id: json[0].stringValue, peerConnectionResponseStr: json[1].stringValue)
                    return done(true)
                case "trustConnection":
                    self.multipeer.trustConnection(id: json[0].stringValue)
                    return done(true)
                case "send":
                    self.multipeer.send(id: json[0].stringValue, data: json[1].stringValue)
                    return done(true)
                case "convey":
                    RunningInstances.singleton!.instances.forEach({instance in
                        instance.push(messageType: "peerData", message: json[0].stringValue)
                    })
                    return done(true)
                default: break
                }
            default: break
        }
        
        return super.callAdapterMethod(methodPath: methodPath, body: body, done: done)
    }
    
    func merge(entryPoint: String) -> String {
        var contents = String(data: FileManager.default.contents(atPath: self.baseJS)!, encoding: .utf8)!
        contents += "\n" + "import(\"\(entryPoint)\")"
        let tmpFile = self.cacheDirectory + "tmp-" + String(Int(Date().timeIntervalSince1970 * 1000)) + ".js"
        try! contents.write(to: URL(string: tmpFile)!, atomically: true, encoding: .utf8)
        return tmpFile
    }
}
