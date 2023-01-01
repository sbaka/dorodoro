//show user iteractions to edit acc and loggout
var popupShown = false
var popup = document.getElementById("my_popup");
var logoutPopUp = document.getElementById("logout_popup")
var editProfilPopUp = document.getElementById("edit_profile_popup")
var overlay = document.getElementById("overlay")

document.getElementById("circle").onclick = () => {
    if (popupShown) { remove(popup); popupShown = false }
    else { show(popup); popupShown = true }
}
//logout popup
document.getElementById("logout").onclick = () => {
    show(logoutPopUp, "block")
    show(overlay, "block")
}
document.getElementById("logout_no").onclick = () => {
    remove(logoutPopUp)
    remove(overlay)
}

//edit profile popup
document.getElementById("edit_profile").onclick = () => {
    show(editProfilPopUp)
    show(overlay, "block")
}
document.getElementById("submit_edit").onclick = () => {
    remove(editProfilPopUp)
    remove(overlay)
}

//when clicking anywhere in the section remove popup
document.getElementsByTagName("section")[0].onclick = () => {
    remove(popup)
    popupShown = false
}

//functions handeling removing 
function remove(element) {
    element.style.display = "none"
    element.style.visibility = "hidden";
}
function show(element, display = "flex") {
    element.style.visibility = "visible"
    element.style.display = display
}