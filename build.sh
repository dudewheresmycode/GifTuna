#!/bin/sh
##mac
electron-packager ./ GifTuna --ignore=\.gitignore --platform=darwin --icon=./resources/icons-v2/logo-hires-v2.icns --out=./build/ --overwrite

##windows
#electron-packager ./ GifTuna --platform=win32 --icon=./resources/icons/giftuna.iconset --out=./build/ --overwrite

##linux
#electron-packager ./ GifTuna --platform=linux --icon=./resources/icons/giftuna-512x512@2x.png --out=./build/ --overwrite
