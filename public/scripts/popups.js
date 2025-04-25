//show user iteractions to edit acc and loggout
let popupShown = false
let popup = document.getElementById("menu-popup");
let logoutPopUp = document.getElementById("logout_popup")
let editProfilPopUp = document.getElementById("profile-edit_popup")
let overlay = document.getElementById("overlay")

document.getElementById("circle").onclick = () => {
    if (popupShown) { remove(popup); popupShown = false }
    else { show(popup); popupShown = true }
}
//logout popup
document.getElementById("logout").onclick = () => {
    show(logoutPopUp, "block")
    show(overlay, "block")
}
document.getElementById("logout-no").onclick = () => {
    remove(logoutPopUp)
    remove(overlay)
}
document.getElementById("logout-yes").onclick = () => {
    remove(logoutPopUp)
    remove(overlay)
    firebase.auth().signOut().then(function () {
        // Sign-out successful.
        localStorage.clear()
        goHome()
    }).catch(function (error) {
        // An error happened.
        alert(error)
    });
}

//edit profile popup
document.getElementById("profile-edit").onclick = () => {
    show(editProfilPopUp)
    show(overlay, "block")
}
document.getElementById("submit-edit").onclick = () => {
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
    element.style.opacity = "0"
}
function show(element, display = "flex") {
    element.style.visibility = "visible"
    element.style.display = display
    element.style.opacity = "1"
    element.style.transition = "opacity 0.5s ease-in-out"
}