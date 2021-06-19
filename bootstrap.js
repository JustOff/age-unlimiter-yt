"use strict";

let Ci = Components.interfaces, Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

let deiObserver;

function startup(data, reason) {
  deiObserver = {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),

    observe: function(aSubject, aTopic, aData) {
      if (aTopic == "document-element-inserted" && aSubject instanceof Ci.nsIDOMDocument &&
          aSubject.defaultView && aSubject.defaultView == aSubject.defaultView.top &&
          aSubject.location.protocol == "https:" &&
          aSubject.location.hostname == "www.youtube.com" &&
          aSubject.contentType == "text/html") {
        let script = aSubject.createElement("script");
        script.textContent = `
(function(window) {
    // Backup original getter/setter for 'ytInitialPlayerResponse', defined by other extensions like AdBlock
    let initialPlayerResponseDescriptor = window.Object.getOwnPropertyDescriptor(window, "ytInitialPlayerResponse");
    let chainedGetter, chainedSetter;
    if (initialPlayerResponseDescriptor instanceof Object &&
        initialPlayerResponseDescriptor.configurable === true) {
      if (initialPlayerResponseDescriptor.get instanceof Function) {
        chainedGetter = initialPlayerResponseDescriptor.get;
      }
      if (initialPlayerResponseDescriptor.set instanceof Function) {
        chainedSetter = initialPlayerResponseDescriptor.set;
      }
    }

    // Re-define 'ytInitialPlayerResponse' to modify the initial player response as soon as the variable is set on page load
    window.Object.defineProperty(window, "ytInitialPlayerResponse", {
        set: function(playerResponse) {
            if (chainedSetter !== undefined) chainedSetter(playerResponse);
            this._wrappedPlayerResponse = inspectJsonData(playerResponse);
        },
        get: function() {
            if (chainedGetter !== undefined) try { return chainedGetter() } catch(e) { };
            return this._wrappedPlayerResponse || {};
        },
        configurable: true
    });

    // Intercept, inspect and modify JSON-based communication to unlock player responses by hijacking the JSON.parse function
    let nativeParse = window.JSON.parse;
    window.JSON.parse = function(text, reviver) {
        return inspectJsonData(nativeParse(text, reviver));
    }

    function inspectJsonData(parsedData) {
        try {
            // Unlock #1: Array based in "&pbj=1" AJAX response on any navigation
            if (Array.isArray(parsedData)) {
                let playerResponseArrayItem = parsedData.find(e => typeof e.playerResponse === "object");
                let playerResponse = playerResponseArrayItem ? playerResponseArrayItem.playerResponse : null;

                if (playerResponse && isUnlockable(playerResponse.playabilityStatus)) {
                    playerResponseArrayItem.playerResponse = unlockPlayerResponse(playerResponse);
                }
            }

            // Unlock #2: Another JSON-Object containing the 'playerResponse'
            if (parsedData.playerResponse && parsedData.playerResponse.playabilityStatus && parsedData.playerResponse.videoDetails && isUnlockable(parsedData.playerResponse.playabilityStatus)) {
                parsedData.playerResponse = unlockPlayerResponse(parsedData.playerResponse);
            }

            // Unlock #3: Initial page data structure and raw player response
            if (parsedData.playabilityStatus && parsedData.videoDetails && isUnlockable(parsedData.playabilityStatus)) {
                parsedData = unlockPlayerResponse(parsedData);
            }

        } catch(e) {
            console.error("Age Unlimiter for YouTube Error: ", e);
        }

        // Filter out video ads missed by uBlock Origin when Age Unlimiter is enabled
        if (parsedData.adPlacements) delete(parsedData.adPlacements);

        return parsedData;
    }

    let unlockablePlayerStates = ["AGE_VERIFICATION_REQUIRED", "LOGIN_REQUIRED", "UNPLAYABLE"];
    function isUnlockable(playabilityStatus) {
        if (!playabilityStatus || !playabilityStatus.status) return false;
        return unlockablePlayerStates.includes(playabilityStatus.status);
    }

    function unlockPlayerResponse(playerResponse) {
        let videoId = playerResponse.videoDetails.videoId;
        let unlockedPayerResponse = getUnlockedPlayerResponse(videoId);

        // check if the unlocked response isn't playable
        if (unlockedPayerResponse.playabilityStatus.status !== "OK")
            throw ("Age Unlimiter for YouTube: Unlock Failed, playabilityStatus: " + unlockedPayerResponse.playabilityStatus.status);

        return unlockedPayerResponse;
    }

    let responseCache = {};
    function getUnlockedPlayerResponse(videoId) {
        // Check if is cached
        if (responseCache.videoId === videoId) return responseCache.content;

        // Query YT's unrestricted api endpoint
        let xmlhttp = new XMLHttpRequest();
        xmlhttp.open("GET", "/get_video_info?html5=1&video_id=" + encodeURIComponent(videoId) + "&eurl=https%3A%2F%2Fyoutube.googleapis.com%2Fv%2F" + encodeURIComponent(videoId) + "&c=TVHTML5&cver=7.20210619", false); // Synchronous!!!
        xmlhttp.send(null);
        let playerResponse = nativeParse(new URLSearchParams(xmlhttp.responseText).get("player_response"));

        // Cache response for 10 seconds
        responseCache = { videoId: videoId, content: playerResponse };
        setTimeout(function() { responseCache = {} }, 10000);

        return playerResponse;
    }
})(document.defaultView);
`;
        aSubject.documentElement.appendChild(script);
      }
    }
  };

  Services.obs.addObserver(deiObserver, "document-element-inserted", false);
}

function shutdown(data, reason) {
  if (reason == APP_SHUTDOWN) {
    return;
  }

  Services.obs.removeObserver(deiObserver, "document-element-inserted", false);
}

function install() {}

function uninstall() {}
