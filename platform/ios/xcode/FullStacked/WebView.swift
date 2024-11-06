//
//  WebView.swift
//  FullStacked
//
//  Created by Charles-Philippe Lepage on 2024-11-06.
//

@preconcurrency import WebKit

let platform = "ios"

class WebView: WKWebView, WKNavigationDelegate, WKScriptMessageHandler {
    private var requestHandler: RequestHandler? = nil
    
    init(instance: Instance) {
        let handler = RequestHandler(instance: instance)
        
        let wkWebViewConfig = WKWebViewConfiguration()
        let userContentController = WKUserContentController()
        wkWebViewConfig.userContentController = userContentController
        wkWebViewConfig.setURLSchemeHandler(handler, forURLScheme: "fs")
        
        super.init(frame: CGRect(), configuration: wkWebViewConfig)
        self.requestHandler = handler
        self.navigationDelegate = self
        
        userContentController.add(self, name: "bridge")
        
        if #available(iOS 16.4, *) {
            self.isInspectable = true
        }
        
        self.load(URLRequest(url: URL(string: "fs://localhost")!))
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override var safeAreaInsets: UIEdgeInsets {
        return UIEdgeInsets(top: super.safeAreaInsets.top, left: 0, bottom: 0, right: 0)
    }
        
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.navigationType == .linkActivated  {
            if let url = navigationAction.request.url, "localhost" != url.host, UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            } else {
                decisionHandler(.allow)
            }
        } else {
            decisionHandler(.allow)
        }
    }
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let data = Data(base64Encoded: message.body as! String)!
        var response = data[0...3]
        let payload = data[4...]
        let responsePayload = self.requestHandler!.instance.callLib(payload: payload)
        response.append(responsePayload)
        self.evaluateJavaScript("window.respond(`\(response.base64EncodedString())`)")
    }
}


class RequestHandler: NSObject, WKURLSchemeHandler {
    let instance: Instance
    
    init(instance: Instance) {
        self.instance = instance
    }
    
    func send(urlSchemeTask: WKURLSchemeTask,
              url: URL,
              statusCode: Int,
              mimeType: String,
              data: Data) {
        
        let responseHTTP = HTTPURLResponse(
            url: url,
            statusCode: statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": mimeType,
                "Content-Length": String(data.count),
                "Cache-Control": "no-cache"
            ]
        )!
        
        urlSchemeTask.didReceive(responseHTTP)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }
    
    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        let request = urlSchemeTask.request
        var pathname = request.url!.pathComponents.filter({$0 != "/"}).joined(separator: "/")
        
        if(pathname.isEmpty) {
            pathname = "/"
        }
        
        if(pathname == "platform") {
            let data = platform.data(using: .utf8)!
            self.send(urlSchemeTask: urlSchemeTask,
                      url: request.url!,
                      statusCode: 200,
                      mimeType: "text/plain",
                      data: data)
            return
        }
        
        // static file serving
        
        let pathnameData = pathname.data(using: .utf8)!
        var payload = Data([
            1, // static file method
            
            2 // STRING
        ])
        payload.append(pathnameData.count.toBytes())
        payload.append(pathnameData)
        
        let response = self.instance.callLib(payload: payload)
        let args = response.deserializeArgs()
        
        send(urlSchemeTask: urlSchemeTask,
             url: request.url!,
             statusCode: 200,
             mimeType: args[0] as! String,
             data: args[1] as! Data)
    }
    
    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) { }
}


extension Int {
    func toBytes() -> Data {
        var bytes = Data(count: 4)
        bytes[0] = UInt8((self & 0xff000000) >> 24);
        bytes[1] = UInt8((self & 0x00ff0000) >> 16)
        bytes[2] = UInt8((self & 0x0000ff00) >> 8)
        bytes[3] = UInt8((self & 0x000000ff) >> 0)
        return bytes
    }
}

extension Data {
    func ptr() -> UnsafeMutableRawPointer? {
        return UnsafeMutableRawPointer(mutating: (self as NSData).bytes)
    }
    
    func toInt() -> Int {
        let bytes = [UInt8](self)
        var value : UInt = 0
        for byte in bytes {
            value = value << 8
            value = value | UInt(byte)
        }
        return Int(value)
    }
    
    func deserializeToNumber() -> Int {
        let bytes = [UInt8](self)
        let negative = bytes[0] == 1;
                
        var n: UInt = 0, i = 1;
        while (i <= bytes.count) {
            n += UInt(bytes[i]) << ((i - 1) * 8)
            i += 1
        }
        
        let value = Int(n);
        
        return negative ? 0 - value : value;
    }
    
    func deserializeArgs() -> [Any?] {
        var args: [Any?] = []
        
        var cursor = 0;
        while(cursor < self.count) {
            let type = DataType(rawValue: self[cursor])
            cursor += 1
            let length = self[cursor...(cursor + 3)].toInt()
            cursor += 4
            let arg = length > 0 ? self[cursor...(cursor + length - 1)] : Data()
            cursor += length
            
            switch (type) {
            case .UNDEFINED:
                args.append(nil)
                break
            case .BOOLEAN:
                args.append(arg[0] == 1 ? true : false)
                break
            case .STRING:
                args.append(String(data: arg, encoding: .utf8))
                break
            case .NUMBER:
                args.append(arg.deserializeToNumber());
                break
            case .UINT8ARRAY:
                args.append(arg)
                break
            case .none:
                print("Unknown type to deserialize")
            }
        }
        
        return args
    }
}

enum DataType: UInt8 {
    case UNDEFINED = 0
    case BOOLEAN = 1
    case STRING = 2
    case NUMBER = 3
    case UINT8ARRAY = 4
}

