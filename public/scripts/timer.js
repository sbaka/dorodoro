const countdownNumberEl = document.getElementById('countdown-number');
const start = document.getElementById("start");
const circle = document.getElementById("svg")
// get initial countdown
const STUDY_TIMER = 120; // user timer
const REST_TIMER = 5;
var studyCountdown = STUDY_TIMER  // variable for countdown
var restCountdown = REST_TIMER // var for countdown
var currentTimer = 0;
var started = false
//init the timer
var myTimer
//set the timer to the user time
countdownNumberEl.innerHTML = secondsToMinutes(STUDY_TIMER); // set the user timer

// the main event which is clicking the start button
start.onclick = function () {
    if (!started) {
        //start the timer and th animation
        myTimer = setInterval(startTimer, 1000)
        circle.style.animation = `countdown ${STUDY_TIMER}s linear infinite forwards`
        start.textContent = "Pause"
        start.style.backgroundColor = "#D92828"
        started = true
    } else {
        //stop timer
        clearInterval(myTimer)
        //stop animation
        circle.style.animationPlayState = 'paused';
        start.textContent = "Resume"
        start.style.backgroundColor = "#2ecc71"
        started = false
    }
};


function startTimer() {
    if (studyCountdown > 0) {
        console.log(studyCountdown);
        studyCountdown = --studyCountdown;
        countdownNumberEl.innerHTML = secondsToMinutes(studyCountdown);
    } else {
        countdownNumberEl.innerHTML = secondsToMinutes(STUDY_TIMER);
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