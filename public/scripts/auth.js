const auth = firebase.auth()

const signInBtn = document.getElementById("sign_in_submit")
const signUpBtn = document.getElementById("sign_up_submit")
const googleSign = document.getElementById("sign_with_google")
const email = document.getElementById("email")
const password = document.getElementById("pwd")
const userName = document.getElementById("userName")
const errorField = document.getElementById("error")
const errorContainer = document.getElementById("error_msg_container")

// Validation patterns
const namePattern = /^[A-Za-z\s]{3,30}$/;
const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

// DOM Elements and UI State
let passwordVisible = false;
let formValid = {
  name: false,
  email: false,
  password: false
};

/**
 * Validates an input field against a pattern
 * @param {HTMLInputElement} field - The input field to validate
 * @param {RegExp} pattern - The validation pattern
 */
function validateField(field, pattern) {
  const value = field.value;
  const fieldId = field.id;
  const validationMessage = document.getElementById(`${fieldId}-validation`);
  let isValid = pattern.test(value);
  
  // Special handling for empty fields
  if (value.length === 0) {
    validationMessage.textContent = 'This field is required';
    validationMessage.classList.add('error');
    isValid = false;
  } else if (!isValid) {
    // Field-specific error messages
    switch(fieldId) {
      case 'userName':
        validationMessage.textContent = 'Name must be 3-30 letters only';
        break;
      case 'email':
        validationMessage.textContent = 'Please enter a valid email address';
        break;
      case 'pwd':
        validationMessage.textContent = 'Password must be at least 8 characters with letters and numbers';
        break;
      default:
        validationMessage.textContent = 'Invalid input';
    }
    validationMessage.classList.add('error');
  } else {
    validationMessage.textContent = '✓';
    validationMessage.classList.remove('error');
    validationMessage.classList.add('success');
  }
  
  // Update form validity state
  if (fieldId === 'userName') formValid.name = isValid;
  if (fieldId === 'email') formValid.email = isValid;
  if (fieldId === 'pwd') {
    formValid.password = isValid;
    updatePasswordStrength(value);
  }
  
  // Enable/disable the submit button based on form validity
  updateSubmitButton();

  return isValid;
}

/**
 * Updates the submit button state based on form validity
 */
function updateSubmitButton() {
  const submitButton = document.getElementById('sign_up_submit');
  if (submitButton) {
    submitButton.disabled = !(formValid.name && formValid.email && formValid.password);
    submitButton.classList.toggle('disabled', !(formValid.name && formValid.email && formValid.password));
  }
}

/**
 * Toggles password visibility
 */
function togglePasswordVisibility() {
  const passwordField = document.getElementById('pwd');
  const toggleButton = document.querySelector('.toggle-password span');
  
  passwordVisible = !passwordVisible;
  passwordField.type = passwordVisible ? 'text' : 'password';
  toggleButton.textContent = passwordVisible ? 'visibility_off' : 'visibility';
}

/**
 * Updates the password strength indicator
 * @param {string} password - The password to evaluate
 */
function updatePasswordStrength(password) {
  const strengthBar = document.getElementById('strength-bar');
  const strengthText = document.getElementById('strength-text');
  
  if (!strengthBar || !strengthText) return;
  
  // Calculate password strength
  let strength = 0;
  
  // Length check
  if (password.length >= 8) strength += 20;
  if (password.length >= 12) strength += 10;
  
  // Complexity checks
  if (/[A-Z]/.test(password)) strength += 20; // Uppercase
  if (/[a-z]/.test(password)) strength += 10; // Lowercase
  if (/\d/.test(password)) strength += 20; // Numbers
  if (/[^A-Za-z0-9]/.test(password)) strength += 20; // Special chars
  
  // Update UI
  strengthBar.style.width = `${strength}%`;
  
  // Update color and text based on strength
  if (strength < 40) {
    strengthBar.style.backgroundColor = '#ff4d4d';
    strengthText.textContent = 'Weak password';
  } else if (strength < 70) {
    strengthBar.style.backgroundColor = '#ffd700';
    strengthText.textContent = 'Medium strength';
  } else {
    strengthBar.style.backgroundColor = '#4CAF50';
    strengthText.textContent = 'Strong password';
  }
}

/**
 * Displays an error message
 * @param {string} message - The error message to display
 */
function showError(message) {
  const errorDiv = document.getElementById('error');
  const errorMsg = document.getElementById('error_msg_container');
  
  if (errorDiv && errorMsg) {
    errorMsg.textContent = message;
    errorDiv.style.visibility = 'visible';
    setTimeout(() => {
      errorDiv.style.visibility = 'hidden';
    }, 5000);
  }
}

/**
 * Handles the form submission event
 * @param {Event} event - The submission event
 */
async function handleSignUp(event) {
  event.preventDefault();
  
  const nameField = document.getElementById('userName');
  const emailField = document.getElementById('email');
  const passwordField = document.getElementById('pwd');
  
  // Validate all fields on submission
  const nameValid = validateField(nameField, namePattern);
  const emailValid = validateField(emailField, emailPattern);
  const passwordValid = validateField(passwordField, passwordPattern);
  
  if (!(nameValid && emailValid && passwordValid)) {
    showError('Please fix the errors before submitting');
    return;
  }
  
  // Show loading state
  const submitButton = document.getElementById('sign_up_submit');
  const originalText = submitButton.value;
  submitButton.value = 'Please wait...';
  submitButton.disabled = true;
  
  try {
    // Create user with Firebase Authentication
    const auth = firebase.auth();
    const userCredential = await auth.createUserWithEmailAndPassword(emailField.value, passwordField.value);
    
    // Update profile with display name
    await userCredential.user.updateProfile({
      displayName: nameField.value
    });
    
    // Store additional user data if needed
    // You could add code here to store user preferences in Firestore/Realtime DB
    
    // Redirect to start page or show success message
    sessionStorage.setItem('userLoggedIn', 'true');
    goStart();
  } catch (error) {
    // Handle specific error cases
    let errorMessage = 'Failed to create account. Please try again.';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'This email is already registered. Please sign in instead.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'The email address is not valid.';
        break;
      case 'auth/weak-password':
        errorMessage = 'Password is too weak. Please use a stronger password.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection and try again.';
        break;
    }
    
    showError(errorMessage);
    
    // Reset button state
    submitButton.value = originalText;
    submitButton.disabled = false;
  }
}

/**
 * Handles Google sign-in
 */
function signInWithGoogle() {
  const googleBtn = document.getElementById('sign_with_google');
  googleBtn.value = 'Connecting...';
  googleBtn.disabled = true;
  
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  
  firebase.auth().signInWithPopup(provider)
    .then((result) => {
      // User successfully signed in
      sessionStorage.setItem('userLoggedIn', 'true');
      goStart();
    })
    .catch((error) => {
      showError('Google sign-in failed. Please try again.');
      googleBtn.value = 'Continue with Google';
      googleBtn.disabled = false;
    });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
  // Add event listeners
  const googleButton = document.getElementById('sign_with_google');
  if (googleButton) {
    googleButton.addEventListener('click', signInWithGoogle);
  }
  
  // Add validation to all edit-form-inputs on page load
  const nameField = document.getElementById('userName');
  const emailField = document.getElementById('email');
  const passwordField = document.getElementById('pwd');
  
  // Initialize form validation state
  if (nameField && emailField && passwordField) {
    validateField(nameField, namePattern);
    validateField(emailField, emailPattern);
    validateField(passwordField, passwordPattern);
  }
});

// Styles for validation messages
document.addEventListener('DOMContentLoaded', function() {
  const style = document.createElement('style');
  style.textContent = `
    .validation-message {
      display: block;
      font-size: 0.8rem;
      margin-top: 5px;
      height: 1em;
    }
    .validation-message.error {
      color: #ff4d4d;
    }
    .validation-message.success {
      color: #4CAF50;
    }
    .password-strength {
      margin-top: 5px;
    }
    .strength-meter {
      height: 5px;
      background-color: #e0e0e0;
      border-radius: 3px;
      overflow: hidden;
    }
    .strength-bar {
      height: 100%;
      width: 0;
      transition: width 0.3s ease, background-color 0.3s ease;
    }
    #strength-text {
      font-size: 0.8rem;
      color: #777;
    }
    .password-container {
      position: relative;
      display: flex;
      align-items: center;
    }
    .toggle-password {
      position: absolute;
      right: 10px;
      background: none;
      border: none;
      cursor: pointer;
      color: #777;
    }
    .disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .input-group {
      margin-bottom: 15px;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `;
  document.head.appendChild(style);
});