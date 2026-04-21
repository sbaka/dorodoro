// Show user interactions to edit account and logout.
const popup = document.getElementById("menu-popup");
const logoutPopUp = document.getElementById("logout-popup");
const editProfilePopUp = document.getElementById("edit-profile-popup");
const overlay = document.getElementById("overlay");
const profileMenuTrigger = document.getElementById("circle");
const profileEditButton = document.getElementById("profile-edit");
const submitEditButton = document.getElementById("submit-edit");
const cancelEditButton = document.getElementById("cancel-edit");
const logoutButton = document.getElementById("logout");
const logoutCancelButton = document.getElementById("logout-no");
const logoutConfirmButton = document.getElementById("logout-yes");
const firstSection = document.querySelector("section");

let popupShown = false;

function hideProfileMenu() {
    if (!popup) {
        return;
    }

    remove(popup);
    popupShown = false;
}

function closeDialogs() {
    if (editProfilePopUp) {
        remove(editProfilePopUp);
    }

    if (logoutPopUp) {
        remove(logoutPopUp);
    }

    if (overlay) {
        remove(overlay);
    }
}

if (profileMenuTrigger && popup) {
    profileMenuTrigger.onclick = (event) => {
        event.stopPropagation();

        if (popupShown) {
            hideProfileMenu();
            return;
        }

        show(popup);
        popupShown = true;
    };
}

if (logoutButton && logoutPopUp && overlay) {
    logoutButton.onclick = () => {
        hideProfileMenu();
        show(logoutPopUp, "block");
        show(overlay, "block");
    };
}

if (logoutCancelButton) {
    logoutCancelButton.onclick = () => {
        closeDialogs();
    };
}

if (logoutConfirmButton) {
    logoutConfirmButton.onclick = () => {
        closeDialogs();
        firebase.auth().signOut().then(function () {
            localStorage.clear();
            goHome();
        }).catch(function (error) {
            alert(error);
        });
    };
}

if (profileEditButton && editProfilePopUp && overlay) {
    profileEditButton.onclick = () => {
        hideProfileMenu();
        show(editProfilePopUp);
        show(overlay, "block");
    };
}

if (submitEditButton) {
    submitEditButton.onclick = () => {
        closeDialogs();
    };
}

if (cancelEditButton) {
    cancelEditButton.onclick = () => {
        closeDialogs();
    };
}

if (overlay) {
    overlay.onclick = () => {
        closeDialogs();
        hideProfileMenu();
    };
}

if (firstSection) {
    firstSection.onclick = () => {
        hideProfileMenu();
    };
}

document.addEventListener("click", (event) => {
    const clickedInsideMenu = event.target.closest("#profil");

    if (!clickedInsideMenu) {
        hideProfileMenu();
    }
});

function remove(element) {
    if (!element) {
        return;
    }

    element.style.display = "none";
    element.style.visibility = "hidden";
    element.style.opacity = "0";
}

function show(element, display = "flex") {
    if (!element) {
        return;
    }

    element.style.visibility = "visible";
    element.style.display = display;
    element.style.opacity = "1";
    element.style.transition = "opacity 0.25s ease-in-out";
}