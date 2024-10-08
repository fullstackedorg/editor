package main

import "C"

import (
	"encoding/json"
	"github.com/evanw/esbuild/pkg/api"
)

//export build
func build(
	Input *C.char, 
	Out *C.char,
	Outdir *C.char, 
	NodePath *C.char, 
	errors **C.char,
) {
	result := api.Build(api.BuildOptions{
		EntryPointsAdvanced: []api.EntryPoint{{
			InputPath:     C.GoString(Input),
			OutputPath:    C.GoString(Out),
		  }},
		Outdir:      	   C.GoString(Outdir),
		Splitting:	 	   true,
		Bundle:      	   true,
		Format:      	   api.FormatESModule,
		Sourcemap:   	   api.SourceMapInlineAndExternal,
		Write:       	   true,
		NodePaths:   	   []string{C.GoString(NodePath)},
	})

	if len(result.Errors) > 0 {
		errorsJSON, _ := json.Marshal(result.Errors)
		*errors = C.CString(string(errorsJSON))
	} else {
		*errors = C.CString(string(""))
	}
}

//export version
func version(VersionStr **C.char) {
	*VersionStr = C.CString(esbuildVersion)
}
