function sendToServer(text) {
  var newRequest = require("sdk/request").Request;
  var makeRequest = newRequest({
    url: "https://54.165.150.24/articleparser/java.php",
    headers: {
            "Content-Type": "application/x-www-form-encoded"
    },
    content: {q: text},
    contentType: "text/html",
    onComplete: function (response) {
      var titlesArray = parseResponse(response.text);
      sendToZotero(titlesArray);
    }
  });
  makeRequest.post();
}

function parseResponse(text) {
    var cleanTitles = [];
    var listStart = text.indexOf("<b>array</b>");
    text = text.slice(listStart);
    text = text.split("\n");

    for (var i = 0; i < text.length; i++) {
      text[i] = text[i].replace(/<\/?[^>]+(>|$)/g, "");
      var stringStart = text[i].indexOf("string");
      var stringEnd = text[i].indexOf("(length=");
      var refTitle = text[i].slice(stringStart, stringEnd);
      var length = text[i].slice(stringEnd);
      length = length.split("=");
      if (length.length > 1) length = length[1].slice(0, -1);
      if (length > 0) {
        var clean = refTitle.slice(10, -2);
        cleanTitles.push(clean.trim());
      }
    }
    return cleanTitles;

}