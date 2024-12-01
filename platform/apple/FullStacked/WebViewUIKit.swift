//
//  ViewRepresentable.swift
//  FullStacked
//
//  Created by Charles-Philippe Lepage on 2024-11-27.
//
import SwiftUI
import WebKit

class WebViewExtended: WKWebView {
    override var safeAreaInsets: UIEdgeInsets {
        return UIEdgeInsets(top: super.safeAreaInsets.top, left: 0, bottom: 0, right: 0)
    }
    
    func openBrowserURL(_ url: URL){
        if( UIApplication.shared.canOpenURL(url)) {
            UIApplication.shared.open(url)
        }
    }
    
    func openDownloadDirectory(){
        UIApplication.shared.open(URL(string: "shareddocuments://" + downloadDirectory)!)
    }
}

struct WebViewRepresentable: UIViewRepresentable {
    private let projectId: String;
    init(webView: WebView) {
        self.projectId = webView.requestHandler.instance.id
    }
    
    func makeUIView(context: Context) -> WebView  {
        return (WebViews.singleton?.getView(projectId: self.projectId))!
    }
    
    func updateUIView(_ uiView: WebView, context: Context) {
        
    }
}