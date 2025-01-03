package org.fullstacked.editor

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.webkit.ValueCallback
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import java.io.File


class MainActivity : ComponentActivity() {
    companion object {
        init {
            System.loadLibrary("editor-core")
        }
    }
    val webViews = mutableListOf<Pair<String, WebViewComponent>>()

    private external fun directories(
        root: String,
        config: String,
        editor: String,
    )

    private external fun callback()

    fun Callback(projectId: String, messageType: String, message: String) {
        if(projectId == "" && messageType == "open") {
            val mainLooper = Looper.getMainLooper()
            val handler = Handler(mainLooper)
            handler.post {
                val webView = WebViewComponent(this, Instance(message))
                this.webViews.add(Pair(message, webView))
                val params =
                    ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                this.addContentView(webView.webView, params)
            }

            return
        }

        val webView = this.webViews.find { it.first == projectId } ?: return
        webView.second.onMessage(messageType, message)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        val root = this.filesDir.absolutePath + "/projects"
        val config = this.filesDir.absolutePath + "/.config"
        val editor = this.filesDir.absolutePath + "/editor"

        this.directories(
            root,
            config,
            editor
        )

        val editorInstance = Instance( "", true)
        val editorWebView = WebViewComponent(this, editorInstance)

        this.extractEditorFiles(editorInstance, editor)

        super.onCreate(savedInstanceState)
        this.fileChooserResultLauncher = this.createFileChooserResultLauncher()

        this.webViews.add(Pair("", editorWebView))

        this.setContentView(editorWebView.webView)

        callback()

        this.onBackPressedDispatcher.addCallback {
            if(webViews.size == 1) {
                webViews.first().second.back { didGoBack ->
                    if(!didGoBack) {
                        moveTaskToBack(true)
                    }
                }
            } else {
                val lastWebView = webViews.last()
                lastWebView.second.back { didGoBack ->
                    if(!didGoBack) {
                        (lastWebView.second.webView.parent as ViewGroup).removeView(lastWebView.second.webView)
                        webViews.remove(lastWebView)
                    }
                }
            }
        }.isEnabled = true

        val data: Uri? = intent?.data
        if(data != null && data.toString().isNotEmpty()) {
            println("LAUNCH URL [$data]")
            editorWebView.onMessage("deeplink", data.toString())
        }
    }

    private fun shouldExtractEditorFromZip(editorDir: String) : String? {
        val currentEditorDir = File(editorDir)
        val currentEditorDirContents = currentEditorDir.listFiles()
        val currentEditorBuildFile = currentEditorDirContents?.find { it.name == "build.txt" }

        val assetContents = this.assets.list("")
        assetContents?.forEach { println(it) }
        val editorZipFileName = assetContents?.find { it.startsWith("editor") }
        val editorZipNumber = editorZipFileName?.split("-")?.last()?.split(".")?.first()
        println("EDITOR VERSION BUILD $editorZipNumber")

        if(currentEditorBuildFile == null) {
            println("EDITOR VERSION NO CURRENT BUILD FILE")
            return editorZipNumber
        }

        val currentEditorBuildNumber = currentEditorBuildFile.readText()

        println("EDITOR VERSION CURRENT BUILD $currentEditorBuildNumber")

        if(editorZipNumber != currentEditorBuildNumber) {
            return editorZipNumber
        }

        return null
    }

    private fun extractEditorFiles(instanceEditor: Instance, editorDir: String) {
        val editorZipNumber = this.shouldExtractEditorFromZip(editorDir)

        if(editorZipNumber == null) {
            println("UNZIPPED SKIPPED !")
            return
        }

        val destination = editorDir.toByteArray()
        val zipData = this.assets.open("editor-$editorZipNumber.zip").readBytes()

        var payload = byteArrayOf(
            30, // UNZIP
            2   // STRING
        )
        payload += numberToBytes(destination.size)
        payload += destination
        payload += byteArrayOf(
            4 // BUFFER
        )
        payload += numberToBytes(zipData.size)
        payload += zipData

        // use absolute path to unzip to
        payload += byteArrayOf(
            1 // BOOLEAN
        )
        payload += numberToBytes(1)
        payload += byteArrayOf(
            1 // true
        )

        val unzipped = deserializeArgs(instanceEditor.callLib(payload))[0] as Boolean
        if(unzipped) {
            println("UNZIPPED !")
            File("$editorDir/build.txt").writeText(editorZipNumber)
        } else {
            println("FAILED TO UNZIPPED")
        }
    }


    lateinit var fileChooserResultLauncher: ActivityResultLauncher<Intent>
    var fileChooserValueCallback: ValueCallback<Array<Uri>>? = null
    private fun createFileChooserResultLauncher(): ActivityResultLauncher<Intent> {
        return this.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            if (it.resultCode == Activity.RESULT_OK) {
                fileChooserValueCallback?.onReceiveValue(arrayOf(Uri.parse(it?.data?.dataString)))
            } else {
                fileChooserValueCallback?.onReceiveValue(null)
            }
        }
    }
}