const countdownNumberEl = document.getElementById('countdown-number');
const start = document.getElementById("start");
const circle = document.getElementById("svg")
//get user perference 
settings = JSON.parse(localStorage.getItem('settings'))
//if there is no settings yet use defaults
if (settings === null) {
    settings = {
        "Pomo Duration": "25",
        "Short Break Duration": "5",
        "Long Break Duration": "15",
        "Long Break Interval": "2",
        "Number Of Pomos": "1"
    }
}
// get initial countdown from user preferences
const POMO_DURATION = minToSec(parseInt(settings["Pomo Duration"])); // user timer
const SHORT_BREAK = minToSec(parseInt(settings["Short Break Duration"]));
const LONG_BREAK = minToSec(parseInt(settings["Long Break Duration"]))
const LONG_BREAK_INTERVAL = minToSec(parseInt(settings["Long Break Interval"]))
const POMOS_NUM = minToSec(parseInt(settings["Number Of Pomos"]))

/*
1- A pomo cycle is 1 study-timer + 1 rest_timer
2- after LONG_BREAK_INTERVAL times => start a longbreak
3- stop after POMOS_NUM reaches 0 (decrements)
 */


var studyCountdown = POMO_DURATION  // variable for countdown
var restCountdown = SHORT_BREAK // var for countdown
var currentTimer = 0;
var started = false
//to save the id of the timer in line 20
var myTimer
//set the timer to the user time
countdownNumberEl.innerHTML = secondsToMinutes(POMO_DURATION); // set the user timer
//init the animation
var animation = anime({
    targets: '#ring',
    strokeDashoffset: [0, anime.setDashoffset],
    easing: 'linear',
    duration: POMO_DURATION * 1000,
    // direction: 'alternate',
});
animation.pause();
// the main event which is clicking the start button
start.onclick = function () {
    if (!started) {
        //start the timer and th animation
        myTimer = setInterval(startTimer, 1000)
        animation.play()
        start.textContent = "Pause"
        start.style.backgroundColor = "#D92828"
        started = true
    } else {
        //stop timer
        clearInterval(myTimer)
        //stop animation
        animation.pause()
        start.textContent = "Resume"
        start.style.backgroundColor = "#2ecc71"
        started = false
    }
};


function startTimer() {
    if (studyCountdown > 0) {
        studyCountdown = --studyCountdown;
        countdownNumberEl.innerHTML = secondsToMinutes(studyCountdown);
    } else {
        countdownNumberEl.innerHTML = secondsToMinutes(POMO_DURATION);
        start.textContent = "Start"
        start.style.backgroundColor = "#2ecc71"
        circle.style.animation = `none`
        clearInterval(myTimer)
    }
}



//converstion
function msToMinutes(ms) {
    return Math.floor(ms / 60000)
}
function minToSec(min) {
    return min * 60
}
function secondsToMinutes(s) {
    if (s < 60) {
        s = s.toLocaleString('en-US', {
            minimumIntegerDigits: 2,
            useGrouping: false
        })
        return "00:" + s
    } else {
        m = Math.floor(s / 60)
        m = m.toLocaleString('en-US', {
            minimumIntegerDigits: 2,
            useGrouping: false
        })
        s = (s % 60).toLocaleString('en-US', {
            minimumIntegerDigits: 2,
            useGrouping: false
        })
        return m + ":" + s
    }
}