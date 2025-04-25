// Get all slider elements and their labels
const minSliders = document.querySelectorAll("input[type='range'][name^='pomo'], input[type='range'][name^='sBr'], input[type='range'][name^='br']");
const minDisplay = document.querySelectorAll("input[name=\"minutes\"]");
const lbrInterSlider = document.querySelector("input[name=\"lBrInter\"]");
const lbrIDisplay = document.querySelector("input[name=\"long_break_interval\"]");
const nbrPomosSlider = document.querySelector("input[name=\"noPomo\"]");
const nbrOfPomosDisplay = document.querySelector("input[name=\"nbrOfPomos\"]");
const settingsForm = document.getElementById("settings-form");

// Create tooltips for all range sliders
function createTooltip(slider) {
  const tooltip = document.createElement('div');
  tooltip.className = 'slider-tooltip';
  tooltip.textContent = slider.value;
  
  // Position the tooltip
  function positionTooltip() {
    const percent = (slider.value - slider.min) / (slider.max - slider.min) * 100;
    tooltip.style.left = `calc(${percent}% + (${8 - percent * 0.15}px))`;
    tooltip.textContent = slider.value;
  }
  
  // Initial position
  slider.parentNode.appendChild(tooltip);
  positionTooltip();
  
  // Update on input
  slider.addEventListener('input', positionTooltip);
  
  // Show/hide tooltip on focus/blur
  slider.addEventListener('focus', () => {
    tooltip.classList.add('active');
  });
  
  slider.addEventListener('blur', () => {
    tooltip.classList.remove('active');
  });
  
  // Also show on hover
  slider.addEventListener('mouseenter', () => {
    tooltip.classList.add('active');
  });
  
  slider.addEventListener('mouseleave', () => {
    if (!slider.matches(':focus')) {
      tooltip.classList.remove('active');
    }
  });
}

// Set the initial values of each element
minDisplay.forEach(element => {
  element.value = element.previousElementSibling.value + " min";
  createTooltip(element.previousElementSibling);
});

lbrIDisplay.value = lbrInterSlider.value + " SBr";
createTooltip(lbrInterSlider);

nbrOfPomosDisplay.value = nbrPomosSlider.value + " pomos";
createTooltip(nbrPomosSlider);

// Add keyboard accessibility to input ranges
function handleKeyDown(e) {
  const slider = e.target;
  
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (slider.value < slider.max) {
      slider.value = parseInt(slider.value) + 1;
      updateDisplayValue(slider);
      slider.dispatchEvent(new Event('input'));
    }
  }
  
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
    e.preventDefault();
    if (slider.value > slider.min) {
      slider.value = parseInt(slider.value) - 1;
      updateDisplayValue(slider);
      slider.dispatchEvent(new Event('input'));
    }
  }
  
  if (e.key === 'Home') {
    e.preventDefault();
    slider.value = slider.min;
    updateDisplayValue(slider);
    slider.dispatchEvent(new Event('input'));
  }
  
  if (e.key === 'End') {
    e.preventDefault();
    slider.value = slider.max;
    updateDisplayValue(slider);
    slider.dispatchEvent(new Event('input'));
  }
}

// Update display value based on slider type
function updateDisplayValue(slider) {
  if (slider.name === 'lBrInter') {
    lbrIDisplay.value = slider.value + " SBr";
  } else if (slider.name === 'noPomo') {
    nbrOfPomosDisplay.value = slider.value + " pomos";
  } else {
    // Find the corresponding display element
    const nextElement = slider.nextElementSibling;
    if (nextElement && nextElement.name === 'minutes') {
      nextElement.value = slider.value + " min";
    }
  }
  
  // Save to local storage for immediate preview in other tabs
  if (settingsForm) {
    const previewSettings = getSettingsFromForm();
    localStorage.setItem('settingsPreview', JSON.stringify(previewSettings));
  }
}

// Add keyboard event listeners to all sliders
document.querySelectorAll('input[type="range"]').forEach(slider => {
  slider.addEventListener('keydown', handleKeyDown);
});

// Add form submission handler
if (settingsForm) {
  settingsForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Show loading state
    const submitButton = document.getElementById('submit_settings');
    if (submitButton) {
      submitButton.innerHTML = '<span class="loading-indicator"></span> Saving...';
      submitButton.disabled = true;
    }
    
    // Clean up preview from localStorage
    localStorage.removeItem('settingsPreview');
    
    // Let the dbAccess.js handle the actual saving
  });
}

// Get settings from form inputs
function getSettingsFromForm() {
  return {
    "Pomo Duration": document.getElementById("pomoDur").value,
    "Short Break Duration": document.getElementById("sBrDur").value,
    "Long Break Duration": document.getElementById("brDur").value,
    "Number Of Pomos": document.getElementById("noPomo").value,
    "Long Break Interval": document.getElementById("lBrInter").value
  };
}

// Add CSS for tooltips to the document
const tooltipStyle = document.createElement('style');
tooltipStyle.textContent = `
  .range {
    position: relative;
    padding-top: 25px;
  }

  .slider-tooltip {
    position: absolute;
    top: 0;
    background-color: #4381A8;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    transform: translateX(-50%);
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }
  
  .slider-tooltip.active {
    opacity: 1;
  }
  
  .slider-tooltip:after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 50%;
    transform: translateX(-50%);
    border-width: 5px 5px 0;
    border-style: solid;
    border-color: #4381A8 transparent transparent;
  }
  
  .loading-indicator {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255,255,255,0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 0.8s linear infinite;
    margin-right: 8px;
  }
  
  @keyframes spin {
    to {transform: rotate(360deg);}
  }
`;

document.head.appendChild(tooltipStyle);

// If there are recommended values, highlight them
function highlightRecommendedValues() {
  // Pomodoro duration recommended range is 25-30 minutes
  const pomoDurSlider = document.getElementById("pomoDur");
  if (pomoDurSlider) {
    const value = parseInt(pomoDurSlider.value);
    if (value >= 25 && value <= 30) {
      pomoDurSlider.classList.add('optimal-range');
    } else {
      pomoDurSlider.classList.remove('optimal-range');
    }
  }
  
  // Add other recommendations as needed
}

// Apply highlighting when values change
document.querySelectorAll('input[type="range"]').forEach(slider => {
  slider.addEventListener('input', highlightRecommendedValues);
});

// Run initial highlight check
highlightRecommendedValues();

// Show reset to defaults button if settings are different from defaults
const defaultSettings = {
  "Pomo Duration": "25",
  "Short Break Duration": "5",
  "Long Break Duration": "20",
  "Number Of Pomos": "4",
  "Long Break Interval": "2"
};

function addResetButton() {
  const actionsContainer = document.querySelector('.settings-actions');
  if (!actionsContainer) return;
  
  // Create reset button if not exists
  if (!document.getElementById('reset-settings')) {
    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.id = 'reset-settings';
    resetButton.className = 'secondary-button';
    resetButton.textContent = 'Reset to Defaults';
    resetButton.addEventListener('click', resetToDefaults);
    
    // Insert before the first child to show at beginning
    actionsContainer.insertBefore(resetButton, actionsContainer.firstChild);
  }
}

function resetToDefaults() {
  // Reset all sliders to default values
  document.getElementById("pomoDur").value = defaultSettings["Pomo Duration"];
  document.getElementById("sBrDur").value = defaultSettings["Short Break Duration"];
  document.getElementById("brDur").value = defaultSettings["Long Break Duration"];
  document.getElementById("noPomo").value = defaultSettings["Number Of Pomos"];
  document.getElementById("lBrInter").value = defaultSettings["Long Break Interval"];
  
  // Update displays
  minDisplay.forEach(element => {
    element.value = element.previousElementSibling.value + " min";
  });
  
  lbrIDisplay.value = lbrInterSlider.value + " SBr";
  nbrOfPomosDisplay.value = nbrPomosSlider.value + " pomos";
  
  // Update tooltips
  document.querySelectorAll('input[type="range"]').forEach(slider => {
    slider.dispatchEvent(new Event('input'));
  });
}

// Add reset button if needed
addResetButton();