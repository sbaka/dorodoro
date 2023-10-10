const minDisplay = document.querySelectorAll("input[name=\"minutes\"]")
const lbrIDisplay = document.querySelector("input[name=\"long_break_interval\"]")
const nbrOfPomosDisplay = document.querySelector("input[name=\"nbrOfPomos\"]")
//set the initial value of each element
minDisplay.forEach(element => {
    element.value = element.previousElementSibling.value + " min"
});
lbrIDisplay.value = lbrIDisplay.previousElementSibling.value + " SBr"
nbrOfPomosDisplay.value = nbrOfPomosDisplay.previousElementSibling.value + " pomos"