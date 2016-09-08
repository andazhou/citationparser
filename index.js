/* Firefox User Interface */

var { ActionButton } = require("sdk/ui/button/action");
var { ToggleButton } = require('sdk/ui/button/toggle');
var panels = require("sdk/panel");
var buttons = require('sdk/ui/button/action');
var tabs = require("sdk/tabs");
var self = require("sdk/self");
var { setTimeout } = require("sdk/timers");
var data = self.data;

// Create a button
require("sdk/ui/button/action").ActionButton({
  id: "show-panel",
  label: "Import from PDF",
  icon: {
    "16": "./icon-16.png",
    "32": "./icon-32.png",
    "64": "./icon-64.png"
  },
  onClick: handleClick
});

// Show the panel when the user clicks the button.
function handleClick(state) {
  pickFile();

}



function userMessage(message) {
  var notifications = require("sdk/notifications");
  var self = require("sdk/self");
  var myIconURL = self.data.url("icon-32.png");

  notifications.notify({
    title: "Citation Manager",
    text: message,
    iconURL: myIconURL
  });
  
}

/*
var filePanel = panels.Panel({
  contentURL: self.data.url("file-upload.html"),
  contentScriptFile: self.data.url("listener.js"),
  onMessage: function (text) {
    console.error(text);
  },
  onHide: handleHide
});


filePanel.port.on("loaded", function (text) {
  console.error(text);
});

function handleClick(state) {
  if (state.checked) {
    filePanel.show({
      position: button
    });
  }
}




*/

function pickFile() {
  let { Cc, Ci } = require('chrome');
  const { atob, btoa } = require("resource://gre/modules/Services.jsm");
  var nsIFilePicker = Ci.nsIFilePicker;
  
  var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
  var window = wm.getMostRecentWindow("");
  
  var fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  fp.init(window, "Dialog Title", nsIFilePicker.modeOpen);
  fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterText);
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
    var file = fp.file;

    var newRequest = require("sdk/request").Request;
    var fileIO = require("sdk/io/file");
    var params = {};
    var data = fileIO.read(file.path, "rb");
    params.log = btoa(data);

    newRequest({
      url: "https://54.165.150.24/articleparser/getpdf.php",
      content: params,
      onComplete: function(response) {
        var titles = response.text.split("@$");
        titles.pop();
        userMessage('Beginning import of PDF references to Zotero...');
        engineHandler(titles);
      }
    }).post();
    
    
    console.error(file.path);  
  }
}

var button = ActionButton({
    id: "clip-button",
    label: "Import single reference from clipboard",
    icon: {
      "16": "./clipboard-16.png",
      "32": "./clipboard-32.png",
      "64": "./clipboard-64.png"
    },
    onClick: clipboardClick
  });

function clipboardClick(state) {
  var clipboard = require("sdk/clipboard");
  var contents = clipboard.get();
  sendToServer(contents);

}

function notify(title) {
  var notifications = require("sdk/notifications");
  var self = require("sdk/self");
  var myIconURL = self.data.url("icon-32.png");

  notifications.notify({
    title: title,
    text: "Importing into Zotero...",
    iconURL: myIconURL
  });
  
}




var contextMenu = require("sdk/context-menu");
var data = require("sdk/self").data;
var menuItem = contextMenu.Item({
  label: "Import Pubmed Reference",
  context: contextMenu.SelectionContext(),
  contentScriptFile: data.url("sc-script.js"),
  onMessage: function (selectionText) {
    HTMLhandler(selectionText);
  }
});

/* End Interface */


/* HTMLhandler(html) - handles all input from user interface
 * in HTML format. Sends any PMIDs in links to pubmedHandler
 * and innerText to server */

function HTMLhandler(html) {
    let { Cc, Ci } = require('chrome');
    var parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
    var PMIDs = [];
    var htmlDoc = parser.parseFromString(html, "text/html");
    var link = htmlDoc.getElementsByTagName('a');
    for (var x = 0; x < link.length; x++) {
        var linki = link[x].href;
        var pubmed = linki.search("pubmed");
        if (pubmed >= 0) {
            PMIDs.push(linki.slice(pubmed));
        }
    }
    if (PMIDs.length === 0) {
       sendToServer(html.replace(/<(?:.|\n)*?>/gm, ''));
    }
    else pubmedHandler(PMIDs);
}


/* sendToServer(text) - sends plaintext to server which returns
 * parsed out titles, sends response to parser */

function sendToServer(text) {
  text = text.replace(/(\r\n|\n|\r)/gm,"");
  var newRequest = require("sdk/request").Request;

  var makeRequest = newRequest({
    url: "https://54.165.150.24/articleparser/java.php",
    headers: {
            "Content-Type": "application/x-www-form-encoded"
    },
    content: {q: text},
    contentType: "text/html",
    onComplete: function (response) {

      parseResponse(response.text);
    }
  });
  
  
  makeRequest.post();

}

/* PMIDtoPMCID(PMID) - converts PMIDs to PMCID if exists using
 * Pubmed's converter */

function PMIDtoPMCID(PMID, itemID) {
  var request = require("sdk/request").Request;
  var makeRequest = request({
    url: "http://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?tool=citationfinder&email=rkaplan@kaplan.rehab&ids=" + PMID.innerText,
    onComplete: function (response) {
      var {Cc, Ci} = require("chrome");
      var Zotero = Cc["@zotero.org/Zotero;1"].getService(Ci.nsISupports).wrappedJSObject;
      var parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
      var xml = parser.parseFromString(response.text, "text/html");
      var article = xml.getElementsByTagName('record')[0];
      var PMCID = article.getAttribute('pmcid');
      if (PMCID) {
      

      console.error(PMCID);
      
       var pmcAttach = new Zotero.Item("attachment");
        pmcAttach = Zotero.Attachments.linkFromURL("https://ncbi.nlm.nih.gov/pmc/articles/" + PMCID, itemID, "Pubmed Central Article", "text/html", true);
                  
        var pdfAttach = new Zotero.Item("attachment");
        pdfAttach = Zotero.Attachments.importFromURL("https://ncbi.nlm.nih.gov/pmc/articles/" + PMCID + "/pdf/", itemID, "application/pdf", "pubmedcentral", false);
      }
    }
  });
  makeRequest.get();
}


/* parseResponse(text) - gets server response and returns array
 * of titles to send to searchers
 * */

function parseResponse(text) {
    
    titles = [];
    text = text.split('@$');
    for (var i = 0; i < text.length; i++) {
        if (text[i].length > 0) {
            text[i] = text[i].replace(/\+/g, ' ');
            text[i] = text[i].split('%2C').join(',');
            text[i] = text[i].split('%22').join('"');
            text[i] = text[i].split('%3A').join(':');
            text[i] = text[i].split('%2F').join('/');
            text[i] = text[i].split('%E2%80%99').join("'");
            titles.push(text[i]);
        }
    }
    console.error(titles);
    
    // Turn titles into readable client-side error log
    
    var titleText = titles.toString();
    titleText = titleText.split(',').join('<br> - ');
    
    let { Cc, Ci } = require('chrome');
    var Zotero = Cc["@zotero.org/Zotero;1"].getService(Ci.nsISupports).wrappedJSObject;
    var collection = Zotero.getActiveZoteroPane().getSelectedCollection(); 
    var note = new Zotero.Item('note');
    note.setNote("Titles that were parsed: <br> - " + titleText);
    var noteID = note.save();
    if (collection) collection.addItem(noteID);
    
    
    engineHandler(titles);
}


function capitalize(string) {
    return string.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

/* pubmedHandler(idArray) - Takes in array of PMIDs and adds them to Zotero with metadata */

function pubmedHandler(idArray) {
 
  // Zotero
  let { Cc, Ci } = require('chrome');
  var Zotero = Cc["@zotero.org/Zotero;1"].getService(Ci.nsISupports).wrappedJSObject;
  var collection = Zotero.getActiveZoteroPane().getSelectedCollection();     
  var Request = require("sdk/request").Request;
  var pmdURL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=" + encodeURIComponent(idArray.join(","));
  console.error(pmdURL);
  var newpmdRequest = Request({
    url: pmdURL,
    onComplete: function (response) {
          var {Cc, Ci} = require("chrome");
          var parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
          var xml = parser.parseFromString(response.text, "text/html");
          var articles = xml.getElementsByTagName("PubmedArticle");
              
          for (var j = 0; j < articles.length; j++) {
            var title = articles[j].getElementsByTagName("ArticleTitle")[0];
            var ID = articles[j].getElementsByTagName("PMID")[0];

            //console.error("Title that was found: " + title.innerText);
            //console.error("Title that was entered: " + titleArray[ID.innerText]);

            
                // Create New Item
                
                var newItem = new Zotero.Item("journalArticle");
                notify(title.innerText);
                // Get metadata
              
                var date = articles[j].getElementsByTagName("DateCreated")[0];
                var pagination = articles[j].getElementsByTagName("MedlinePgn")[0];
                var volume = articles[j].getElementsByTagName("Volume")[0];
                var journal = articles[j].getElementsByTagName("Title")[0];
                var issue = articles[j].getElementsByTagName("Issue")[0];
                var abstracText = articles[j].getElementsByTagName("AbstractText")[0];
                var journalAbbr = articles[j].getElementsByTagName("ISOAbbreviation")[0];
                var issn = articles[j].getElementsByTagName("ISSN")[0];

                
                var authors = articles[j].getElementsByTagName("Author");
                
                for (var k = 0; k < authors.length; k++) {
                  var creator = new Zotero.Creator;
                  var lastName = authors[k].getElementsByTagName("LastName")[0];
                  var firstName = authors[k].getElementsByTagName("ForeName")[0];
                  if (lastName) creator.lastName = lastName.innerText;
                  if (firstName) creator.firstName = firstName.innerText;
                  creator.save();
                  newItem.setCreator(k, creator, 'author');
                }
                
                // Set metadata
                if (title) newItem.setField('title', title.innerText);
                if (date) newItem.setField('date', date.innerText);
                if (pagination) newItem.setField('pages', pagination.innerText);
                if (issue) newItem.setField('issue', issue.innerText);
                if (volume) newItem.setField('volume', volume.innerText);
                if (journal) newItem.setField('publicationTitle', journal.innerText);
                if (abstracText) newItem.setField('abstractNote', abstracText.innerText);
                if (issn) newItem.setField('ISSN', issn.innerText);
                if (journalAbbr) newItem.setField('journalAbbreviation', journalAbbr.innerText);
                if (ID) newItem.setField('extra', 'PMID: ' + ID.innerText);
                if (ID) newItem.setField('url', 'https://ncbi.nlm.nih.gov/pubmed/' + ID.innerText);
                
                var itemID = newItem.save();
                
                if (collection) collection.addItem(itemID);
          
                var ftURL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pubmed&id=" + ID.innerText + "&cmd=prlinks&retmode=ref";
                var ftAttach = new Zotero.Item("attachment");
                ftAttach = Zotero.Attachments.linkFromURL(ftURL, itemID, "text/html", "Pubmed Full-text Link", false);
              
                // Attach Pubmed snapshot
                var pmdAttach = new Zotero.Item("attachment");
                pmdAttach = Zotero.Attachments.importFromURL("https://ncbi.nlm.nih.gov/pubmed/" + ID.innerText, itemID, "Pubmed Article", "text/html", true);
                
                PMIDtoPMCID(ID, itemID);

            

          }

        }
  });
  newpmdRequest.get();
 
}


/* titleMatch(title, secondTitle) - strips all punctuation from
 * titles and determines if they are an exact word match */

function titleMatch(title, secondTitle) {
  title = title.replace(/[.,\/#!$%\^&\*+;:{}=\-_`~()]/g," ");
  secondTitle = secondTitle.replace(/[.,+\/#!$%\^&\*;:{}=\-_`~()]/g," ");
  title = title.toLowerCase(title);
  secondTitle = secondTitle.toLowerCase(secondTitle);
  title = title.trim();
  secondTitle = secondTitle.trim();
  if (title == secondTitle) return true;
  else return false;
}




function acaSearch(title) {
  var Request = require("sdk/request").Request;
    title = title.replace(/[.,\/#!$%\^&\*+;:{}\_`~()]/g,"");
    title = title.split('/').join(' ');
    title = title.split('-').join(' ');
    title = title.split("'").join(' ');
    title = title.split('=').join(' ');
    title = title.trim();
    title = title.toLowerCase();
    console.error("Searching MSA for: " + title);
    // Entity attributes: Id, Ti, Y, D, AA.AuN, J.JN, W, E
    var maPath = "https://api.projectoxford.ai/academic/v1.0/evaluate?expr=Ti='" + title + "'...&model=latest&count=1&attributes=Id,Ti,Y,D,AA.AuN,J.JN,W,E";
    
    
    
    
    var newRequest = Request({
      url: maPath,
      headers: {
              "Ocp-Apim-Subscription-Key": "6133b6e749be47d9a0fd40080744cbc5"
      },
      onComplete: function (response) {
        var parse = JSON.parse(response.text);
        var data = parse.entities[0];
        let { Cc, Ci } = require('chrome');
        var Zotero = Cc["@zotero.org/Zotero;1"].getService(Ci.nsISupports).wrappedJSObject;
        if (data) {
          var meta = JSON.parse(data.E);
          
          // Add to Zotero
          
          console.error(data);
          console.error(meta);
  
          
          var newItem = new Zotero.Item("journalArticle");
          
          // Title
          var title = meta.DN;
  
          // Authors
          if (data.AA) {
            for (var j = 0; j < data.AA.length; j++) {
              var creator = new Zotero.Creator;
              var name = data.AA[j].AuN;
              name = capitalize(name);
              creator.lastName = name;
              creator.save();
              newItem.setCreator(j, creator, 'author');
            }
          }
            var DOI, journal, abbrev, volume, issue, abstrac, pages, date;
          // Other metadata
          if (meta.DOI) DOI = meta.DOI;
          if (meta.VFN) journal = meta.VFN;
          if (data.J) abbrev = data.J.JN;
          if (meta.V) volume = meta.V;
          if (meta.I) issue = meta.I;
          if (meta.FP && meta.LP) pages = meta.FP + "-" + meta.LP;
          if (meta.D) abstrac = meta.D;
          if (data.D) date = data.D;
          var MAID = data.Id;
          var url = "https://academic.microsoft.com/#/detail/" + MAID;
          
  
     
          newItem.setField('title', title);
          newItem.setField('date', date);
          newItem.setField('url', url);
          newItem.setField('volume', volume);
          newItem.setField('issue', issue);
          newItem.setField('pages', pages);
          newItem.setField('publicationTitle', journal);
          newItem.setField('abstractNote', abstrac);
          newItem.setField('journalAbbreviation', abbrev);
          newItem.setField('extra', 'Microsoft Academic ID: ' + MAID);
          newItem.setField('DOI', DOI);
          var collection = Zotero.getActiveZoteroPane().getSelectedCollection();

          notify(title);
          
          var itemID = newItem.save();
          
          if (collection) collection.addItem(itemID);
          
          // Find sources
          for (var x = 0; x < meta.S.length; x++) {
            
            // PDF source exists
            if (meta.S[x].Ty == 3) {
              var pdfAttach = new Zotero.Item("attachment");
              pdfAttach = Zotero.Attachments.importFromURL(meta.S[x].U, itemID, "application/pdf", "msacademic", false);
            }
            else if (meta.S[x].Ty == 1) {
              var newAttach = new Zotero.Item("attachment");
              newAttach = Zotero.Attachments.linkFromURL(meta.S[x].U, itemID, "text/html", "Link to full-text source", false);
            }
          }
        }
        else {
          var gsTitle = parse.expr.slice(4, -4);
          google(gsTitle);
          
        }
        

      }
        
    }).get();
}

/* academicHandler(titles) - makes HTTP requests to MSAcademic API for each
 * title and if an exact match is found, adds item into Zotero
 * */

var data = require("sdk/self").data;
var selectPanel = require("sdk/panel").Panel({
    contentURL: data.url("file-upload.html")
});

function engineHandler(titles) {
  
  // Let user choose titles to import
  let { Cc, Ci } = require('chrome');
  let Window = Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher);
  let arg = {};
  for (var i = 0; i < titles.length; i++) {
    arg['check_' + i] = 'false';  
  }

let window = Window.activeWindow.openDialog("chrome://citationparser/content/prompt.xul", "myWindow", "chrome,modal,centerscreen", arg, titles);


  for (var j = 0; j < titles.length; j++) {
    if (arg['check_' + j]) {
      googleTitle(titles[j]);
    }

  }
  
}



function googleTitle(title) {
    var Request = require("sdk/request").Request;
  var newRequest = Request({
      url: "https://scholar.google.com/scholar?q=" + title,
      onComplete: function (response) {
        let { Cc, Ci } = require('chrome');
        var Zotero = Cc["@zotero.org/Zotero;1"].getService(Ci.nsISupports).wrappedJSObject;
          var parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
          var htmlDoc = parser.parseFromString(response.text, "text/html");
          var gtitle = htmlDoc.getElementsByClassName('gs_rt')[0].innerText;
          if (gtitle) {
            acaSearch(gtitle);
          }
          else {
            console.error(title);
            acaSearch(title);
          }

      }
  }).get();
  
}

function google(title) {
  var Request = require("sdk/request").Request;
  var newRequest = Request({
      url: "https://scholar.google.com/scholar?q=" + title,
      onComplete: function (response) {
        let { Cc, Ci } = require('chrome');
        var Zotero = Cc["@zotero.org/Zotero;1"].getService(Ci.nsISupports).wrappedJSObject;
          var parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
          var htmlDoc = parser.parseFromString(response.text, "text/html");
          var title = htmlDoc.getElementsByClassName('gs_rt')[0].innerText;
          var article = htmlDoc.getElementsByClassName('gs_rt')[0];

          var newItem = new Zotero.Item("journalArticle");
          newItem.setField('title', title);
          var url = htmlDoc.getElementsByClassName('gs_rt')[0].getElementsByTagName('a')[0].href;
          
          newItem.setField('url', url);
          var abstractNote = htmlDoc.getElementsByClassName('gs_rs')[0].innerText;
          newItem.setField('abstractNote', abstractNote);
          var meta = htmlDoc.getElementsByClassName('gs_a')[0].innerText;
          meta = meta.split('-');
          console.error(meta);
          var authors = meta[0];
          authors = authors.split(',');
          for (var j = 0; j < authors.length; j++) {
            var creator = new Zotero.Creator;
            var name = authors[j];
            creator.lastName = name;
            creator.save();
            newItem.setCreator(j, creator, 'author');
          }
          var publication = meta[1].split(',');
          var date = publication[1];
          var journal = publication[0];
          newItem.setField('publicationTitle', journal);
          newItem.setField('date', date);
          
          var collection = Zotero.getActiveZoteroPane().getSelectedCollection();

          notify(title);
          
          var itemID = newItem.save();
          

          var linkAttach = new Zotero.Item("attachment");
          linkAttach = Zotero.Attachments.linkFromURL(url, itemID, "text/html", "Full-text Link", true);
          
          
          if (collection) collection.addItem(itemID);
          var pdfurl = article.getElementsByClassName('gs_ggsd')[0].getElementsByTagName('a')[0].href;
          var pdfAttach = new Zotero.Item("attachment");
          pdfAttach = Zotero.Attachments.importFromURL(pdfurl, itemID, "application/pdf", "msacademic", false);
          

      }
  }).get();
}



