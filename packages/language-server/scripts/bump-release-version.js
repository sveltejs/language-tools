// @ts-check

const { writeFileSync, readFileSync } = require("fs");
const { join } = require("path");

const axios = require("axios").default;

const getPackageVersion = async () => {
  const npmInfo = await axios({ url:"https://registry.npmjs.org/svelte-language-server", method: "GET" });
  if (!npmInfo.data || !npmInfo.data._id) {
    throw new Error("Got a bad response from NPM");
  }

  return npmInfo.data['dist-tags'].latest;
};


const go = async () => {
  const version = await getPackageVersion();
  if (!version) throw new Error("Could not find the npm version in the registry");

  const semverMarkers = version.split(".");
  const newVersion = `${semverMarkers[0]}.${semverMarkers[1]}.${Number(semverMarkers[2]) + 1}`;

  const pkgPath = join(__dirname, "..", "package.json");
  const oldPackageJSON = JSON.parse(readFileSync(pkgPath, "utf8"));
  oldPackageJSON.version = newVersion;
  writeFileSync(pkgPath, JSON.stringify(oldPackageJSON));

  console.log("Updated to " + newVersion);
};

go();
