var contextMenu = require("sdk/context-menu");
var buttons = require('sdk/ui/button/action');
var data = require("sdk/self").data;
var tabs = require("sdk/tabs");

var button = buttons.ActionButton({
    id: "ageless-yt-me-button",
    label: "Watch age restricted video",
    icon: {
        "32": "./icon.png"
    },
    onClick: handleClick
});

var contextMenu = contextMenu.Item({
    label: "Watch age restricted video",
    context: contextMenu.URLContext("*.youtube.com"),
    contentScript: 'self.on("click", function () { self.postMessage(); });',
    onMessage: function () {
        handleClick();
    }
});

function handleClick() {
    var activeTabUrl = tabs.activeTab.url;
    var regexp = /www\.youtube\.com\/watch\?v=([\w-_]*)/;

    if (regexp.test(activeTabUrl) === true) {
        var url = "https://www.youtube.com/embed/" + activeTabUrl.match(regexp)[1] + "?autoplay=1";
        tabs.open(url);
    }
}
