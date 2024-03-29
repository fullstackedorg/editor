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
    init(){
        let editorDirectory = Bundle.main.bundlePath + "/build"
        super.init(adapter: AdapterEditor(baseDirectory: editorDirectory))
        self.webview.isOpaque = false
    }
}

class AdapterEditor: Adapter {
    let rootDirectory = documentsDirectory
    private let baseJS = Bundle.main.bundlePath + "/js/index.js"
    let cacheDirectory = FileManager.default.temporaryDirectory.absoluteString
    let configDirectory = ".config/fullstacked"
    let nodeModulesDirectory: String
    let fsEditor: AdapterFS;
    
    override init(baseDirectory: String) {
        self.nodeModulesDirectory = configDirectory + "/node_modules"
        self.fsEditor = AdapterFS(baseDirectory: self.rootDirectory);
        super.init(baseDirectory: baseDirectory)
    }
    
    override func callAdapterMethod(methodPath: [String.SubSequence], body: Data, done: @escaping (_ maybeData: Any?) -> Void) {
        if(methodPath.count == 0) {
            return done(nil)
        }
        
        let json = try! JSON(data: body)
        
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
                        
                            return done(self.fsEditor.writeFile(file: json[0].stringValue, data: data))
                        case "unlink": return done(self.fsEditor.unlink(path: json[0].stringValue))
                        case "readdir": return done(self.fsEditor.readdir(path: json[0].stringValue, withFileTypes: json[1]["withFileTypes"].boolValue))
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
                
                var entryPoint: String? = nil;
                [
                    self.rootDirectory + "/" + project["location"].stringValue + "/index.jsx",
                    self.rootDirectory + "/" + project["location"].stringValue + "/index.js"
                ].forEach { file in
                    let existsAndIsDirectory = AdapterFS.itemExistsAndIsDirectory(file)
                    if(existsAndIsDirectory != nil && !existsAndIsDirectory!){
                        entryPoint = file
                    }
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
