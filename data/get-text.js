
var area = document.getElementById('here');

// Listen for the "show" event being sent from the
// main add-on code. It means that the panel's about
// to be shown.
//
// Set the focus to the text area so the user can
// just start typing.
addon.port.on("ready", function (text) {
  var html = "";
  html = html + "Please select articles for import: <br><br><input type='checkbox' id='selectall' onClick='selectAll(this)' /> Select All <br>";
  for (var i = 0; i < text.length; i++) {
    html = html + "<input type='checkbox' name='titles' value=" + i + "/>" + text[i] + "<br />";
  }
  html = html + "<input name='sbutton' type='submit' value='Submit' onClick='clickSubmit()'/>";
  html = html + "<script language='javascript'>function clickSubmit() { var boxes = document.getElementsByName('titles'); var values = []; for (var i = 0; i < boxes.length; i++) { if (boxes[i].checked) values.push(boxes[i].value);} addon.port.emit('selectionMade', values); return values;}</script>";
  area.innerHTML = html;
  console.error('got ready message from main');

  addon.port.emit("show");

});

