package config

import (
	fs "fullstacked/editor/src/fs"
	serialize "fullstacked/editor/src/serialize"
	setup "fullstacked/editor/src/setup"
	"path"
)

var fileEventOrigin = "config"

func Get(configFile string) []byte {
	filePath := path.Join(setup.Directories.Config, configFile+".json")

	config, err := fs.ReadFile(filePath)

	if err != nil {
		return nil
	}

	return serialize.SerializeString(string(config))
}

func Save(configFile string, data string) []byte {
	filePath := path.Join(setup.Directories.Config, configFile+".json")

	fs.Mkdir(path.Dir(filePath), fileEventOrigin)

	err := fs.WriteFile(filePath, []byte(data), fileEventOrigin)

	if err != nil {
		return serialize.SerializeBoolean(false)
	}

	return serialize.SerializeBoolean(true)
}
