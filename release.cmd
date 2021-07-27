@echo off
set VER=2.0.5

sed -i -E "s/version>.+?</version>%VER%</" install.rdf
sed -i -E "s/version>.+?</version>%VER%</; s/download\/.+?\/age-unlimiter-yt-.+?\.xpi/download\/%VER%\/age-unlimiter-yt-%VER%\.xpi/" update.xml

set XPI=age-unlimiter-yt-%VER%.xpi
if exist %XPI% del %XPI%
zip -r9q %XPI% * -x .git/* .gitignore update.xml LICENSE README.md *.cmd *.xpi *.exe
