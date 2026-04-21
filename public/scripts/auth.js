const auth = firebase.auth()
const EMAIL_LINK_STORAGE_KEY = 'dorodoro.emailForSignIn'

const signInBtn = document.getElementById("sign-in-submit")
const signUpBtn = document.getElementById("sign-up-submit")
const googleSign = document.getElementById("sign-with-google")
const email = document.getElementById("email")
const password = document.getElementById("pwd")
const userName = document.getElementById("userName")
const errorField = document.getElementById("error")
const errorContainer = document.getElementById("error-msg-container")

// Validation patterns
const namePattern = /^[A-Za-z\s]{3,30}$/;
const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

// DOM Elements and UI State
let passwordVisible = false;
let messageTimeoutId = null;
let formValid = {
  name: false,
  email: false,
  password: false
};
const touchedFields = new Set();

/**
 * Validates an input field against a pattern
 * @param {HTMLInputElement} field - The input field to validate
 * @param {RegExp} pattern - The validation pattern
 */
function validateField(field, pattern, options = {}) {
  const value = field.value;
  const fieldId = field.id;
  const validationMessage = document.getElementById(`${fieldId}-validation`);
  let isValid = pattern.test(value);
  const shouldShowMessage = options.force || touchedFields.has(fieldId);

  if (!validationMessage) {
    return isValid;
  }

  touchedFields.add(fieldId);
  validationMessage.classList.remove('error', 'success');
  
  // Special handling for empty fields
  if (value.length === 0) {
    validationMessage.textContent = shouldShowMessage ? 'This field is required' : '';
    if (shouldShowMessage) {
      validationMessage.classList.add('error');
    }
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
    validationMessage.textContent = '';
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
  const submitButton = document.getElementById('sign-up-submit');
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
  const strengthWrapper = document.getElementById('password-strength');
  
  if (!strengthBar || !strengthText || !strengthWrapper) return;

  if (!password) {
    strengthWrapper.style.display = 'none';
    strengthBar.style.width = '0%';
    strengthBar.style.backgroundColor = '#d7e1e8';
    strengthText.textContent = 'Use at least 8 characters with letters and numbers';
    return;
  }

  strengthWrapper.style.display = 'block';
  
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
 * Hides the current message banner
 */
function hideMessage() {
  const messageBox = document.getElementById('error');
  if (!messageBox) {
    return;
  }

  if (messageTimeoutId) {
    clearTimeout(messageTimeoutId);
    messageTimeoutId = null;
  }

  messageBox.style.display = 'none';
  messageBox.style.visibility = 'hidden';
  messageBox.classList.remove('is-error', 'is-success', 'is-info');
}

/**
 * Displays a message in the shared banner
 * @param {string} message - The message to display
 * @param {'error' | 'success' | 'info'} type - The message type
 */
function showMessage(message, type = 'error') {
  const messageBox = document.getElementById('error');
  const messageText = document.getElementById('error-msg-container');
  const messageIcon = messageBox ? messageBox.querySelector('.material-symbols-outlined') : null;

  if (!messageBox || !messageText) {
    return;
  }

  hideMessage();

  messageText.textContent = message;
  messageBox.classList.add(`is-${type}`);
  messageBox.style.display = 'flex';
  messageBox.style.visibility = 'visible';

  if (messageIcon) {
    if (type === 'success') {
      messageIcon.textContent = 'check_circle';
    } else if (type === 'info') {
      messageIcon.textContent = 'info';
    } else {
      messageIcon.textContent = 'error';
    }
  }

  messageTimeoutId = window.setTimeout(hideMessage, type === 'error' ? 5000 : 6500);
}

/**
 * Displays an error message
 * @param {string} message - The error message to display
 */
function showError(message) {
  showMessage(message, 'error');
}

/**
 * Displays a success message
 * @param {string} message - The success message to display
 */
function showSuccess(message) {
  showMessage(message, 'success');
}

/**
 * Builds the login URL used by Firebase email actions
 * @returns {string}
 */
function getLoginActionUrl() {
  const loginUrl = new URL('./login.html', window.location.href);
  loginUrl.search = '';
  loginUrl.hash = '';
  return loginUrl.toString();
}

/**
 * Returns Firebase action settings for magic-link sign-in
 * @returns {{url: string, handleCodeInApp: boolean}}
 */
function getEmailActionSettings() {
  return {
    url: getLoginActionUrl(),
    handleCodeInApp: true
  };
}

/**
 * Normalizes and validates the current email input
 * @returns {string | null}
 */
function getValidatedEmail() {
  const emailField = document.getElementById('email');
  if (!emailField) {
    return null;
  }

  emailField.value = emailField.value.trim();
  const emailValue = emailField.value;
  const emailIsValid = validateField(emailField, emailPattern, { force: true });

  if (!emailValue) {
    showError('Enter your email address first.');
    emailField.focus();
    return null;
  }

  if (!emailIsValid) {
    showError('Use a valid email address to continue.');
    emailField.focus();
    return null;
  }

  return emailValue;
}

/**
 * Sends a password reset email to the current address
 * @param {Event} event - The click event
 */
async function sendPasswordReset(event) {
  event.preventDefault();

  const emailValue = getValidatedEmail();
  if (!emailValue) {
    return;
  }

  const resetButton = document.getElementById('forgot-password-link');
  const originalLabel = resetButton ? resetButton.textContent : '';
  if (resetButton) {
    resetButton.disabled = true;
    resetButton.textContent = 'Sending reset...';
  }

  try {
    await auth.sendPasswordResetEmail(emailValue);
    showSuccess('If that email has an account, a reset link is on its way. Check your inbox and spam folder.');
  } catch (error) {
    switch (error.code) {
      case 'auth/invalid-email':
        showError('Use a valid email address to reset your password.');
        break;
      case 'auth/network-request-failed':
        showError('Network error. Check your connection and try again.');
        break;
      default:
        showError('Could not send the reset email right now. Try again in a moment.');
        break;
    }
  } finally {
    if (resetButton) {
      resetButton.disabled = false;
      resetButton.textContent = originalLabel;
    }
  }
}

/**
 * Sends a Firebase email sign-in link to the current address
 * @param {Event} event - The click event
 */
async function sendMagicLink(event) {
  event.preventDefault();

  const emailValue = getValidatedEmail();
  if (!emailValue) {
    return;
  }

  const magicLinkButton = document.getElementById('magic-link-button');
  const originalLabel = magicLinkButton ? magicLinkButton.textContent : '';
  if (magicLinkButton) {
    magicLinkButton.disabled = true;
    magicLinkButton.textContent = 'Sending magic link...';
  }

  try {
    await auth.sendSignInLinkToEmail(emailValue, getEmailActionSettings());
    window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, emailValue);
    showSuccess('Magic link sent. Open it from your email to finish signing in.');
  } catch (error) {
    switch (error.code) {
      case 'auth/invalid-email':
        showError('Use a valid email address to receive a magic link.');
        break;
      case 'auth/argument-error':
        showError('Email-link sign-in needs to be enabled in Firebase Authentication before it can work here.');
        break;
      case 'auth/network-request-failed':
        showError('Network error. Check your connection and try again.');
        break;
      default:
        showError('Could not send the magic link right now. Try again in a moment.');
        break;
    }
  } finally {
    if (magicLinkButton) {
      magicLinkButton.disabled = false;
      magicLinkButton.textContent = originalLabel;
    }
  }
}

/**
 * Completes Firebase email-link sign-in when the page is opened from a magic link
 */
async function completeMagicLinkSignIn() {
  if (!auth.isSignInWithEmailLink(window.location.href)) {
    return;
  }

  const emailField = document.getElementById('email');
  let emailValue = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);

  if (!emailValue && emailField && emailField.value.trim()) {
    emailValue = emailField.value.trim();
  }

  if (!emailValue) {
    emailValue = window.prompt('Enter the email address you used for the sign-in link.');
  }

  if (!emailValue) {
    showError('Enter the same email address you used for the magic link to finish signing in.');
    return;
  }

  emailValue = emailValue.trim();
  if (emailField) {
    emailField.value = emailValue;
  }

  showMessage('Checking your magic link...', 'info');

  try {
    await auth.signInWithEmailLink(emailValue, window.location.href);
    window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
    sessionStorage.setItem('userLoggedIn', 'true');
    showSuccess('Magic link accepted. Redirecting...');
    goStartHome();
  } catch (error) {
    switch (error.code) {
      case 'auth/invalid-email':
        showError('That email does not match the one used for the magic link.');
        break;
      case 'auth/invalid-action-code':
      case 'auth/expired-action-code':
        showError('This magic link is no longer valid. Request a new one and try again.');
        break;
      default:
        showError('Could not finish magic-link sign-in. Request a fresh link and try again.');
        break;
    }
  }
}

/**
 * Handles the sign up form submission
 * @param {Event} event - The form submission event
 */
async function handleSignUp(event) {
  event.preventDefault();
  
  const nameField = document.getElementById('userName');
  const emailField = document.getElementById('email');
  const passwordField = document.getElementById('pwd');
  
  // Validate all fields on submission
  const nameValid = validateField(nameField, namePattern, { force: true });
  const emailValid = validateField(emailField, emailPattern, { force: true });
  const passwordValid = validateField(passwordField, passwordPattern, { force: true });
  
  if (!(nameValid && emailValid && passwordValid)) {
    showError('Please fix the errors before submitting');
    return;
  }
  
  // Show loading state
  const submitButton = document.getElementById('sign-up-submit');
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
 * Handles the sign in form submission
 * @param {Event} event - The form submission event
 */
async function handleSignIn(event) {
  event.preventDefault();
  
  const emailField = document.getElementById('email');
  const passwordField = document.getElementById('pwd');
  emailField.value = emailField.value.trim();
  
  if (!validateField(emailField, emailPattern, { force: true })) {
    showError('Use a valid email address to sign in.');
    return;
  }

  if (!passwordField.value) {
    showError('Email and password are required');
    return;
  }
  
  // Show loading state
  const submitButton = document.getElementById('sign-in-submit');
  const originalText = submitButton.value;
  submitButton.value = 'Signing in...';
  submitButton.disabled = true;
  
  try {
    // Sign in with Firebase Authentication
    const auth = firebase.auth();
    await auth.signInWithEmailAndPassword(emailField.value, passwordField.value);
    
    // Set user logged in session and redirect
    sessionStorage.setItem('userLoggedIn', 'true');
    goStartHome();
  } catch (error) {
    // Handle specific error cases
    let errorMessage = 'Failed to sign in. Please check your credentials.';
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'No account found with this email. Please sign up first.';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Incorrect password. Please try again.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email format.';
        break;
      case 'auth/user-disabled':
        errorMessage = 'This account has been disabled.';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many failed attempts. Please try again later.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection.';
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
  const googleBtn = document.getElementById('sign-with-google');
  const googleBtnLabel = googleBtn ? googleBtn.querySelector('.google-button-label') : null;
  if (googleBtnLabel) {
    googleBtnLabel.textContent = 'Connecting...';
  }
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
      if (googleBtnLabel) {
        googleBtnLabel.textContent = 'Continue with Google';
      }
      googleBtn.disabled = false;
    });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
  completeMagicLinkSignIn();

  // Add event listeners
  const signInButton = document.getElementById('sign-in-submit');
  if (signInButton) {
    // The form's onsubmit handles this, but we're being extra careful
    signInButton.addEventListener('click', function(e) {
      if (e.target.form) e.preventDefault();
      handleSignIn(e);
    });
  }
  
  const signUpButton = document.getElementById('sign-up-submit');
  if (signUpButton) {
    // The form's onsubmit handles this, but we're being extra careful
    signUpButton.addEventListener('click', function(e) {
      if (e.target.form) e.preventDefault();
      handleSignUp(e);
    });
  }
  
  const googleButton = document.getElementById('sign-with-google');
  if (googleButton) {
    googleButton.addEventListener('click', signInWithGoogle);
  }

  const forgotPasswordButton = document.getElementById('forgot-password-link');
  if (forgotPasswordButton) {
    forgotPasswordButton.addEventListener('click', sendPasswordReset);
  }

  const magicLinkButton = document.getElementById('magic-link-button');
  if (magicLinkButton) {
    magicLinkButton.addEventListener('click', sendMagicLink);
  }
  
  // Add validation to all edit-form-inputs on page load
  const nameField = document.getElementById('userName');
  const emailField = document.getElementById('email');
  const passwordField = document.getElementById('pwd');
  
  // Initialize form validation state
  if (nameField && emailField && passwordField) {
    updateSubmitButton();
    updatePasswordStrength('');
  }
  
});
