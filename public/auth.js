// Initialize the Supabase client
const supabaseUrl = 'https://flrardzrflwricwqzzdv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZscmFyZHpyZmx3cmljd3F6emR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3MjgwNTQsImV4cCI6MjA2MDMwNDA1NH0.hrR7bSyy6Tgxr7NtQ-Ert6Es2OMRCcEoNUTB6Uwv8mU';

// This was the bug - incorrect initialization of the Supabase client
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', async () => {
  // Check if we're on the index page or login page
  const isIndexPage = window.location.pathname.endsWith('index.html') || 
                       window.location.pathname.endsWith('/');
  const isLoginPage = window.location.pathname.endsWith('login.html');
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // User is logged in
    if (isLoginPage) {
      // Redirect to index if on login page
      window.location.href = 'index.html';
    }
    // If on index page, user is already logged in, so do nothing
    console.log("Logged in as:", user.email);
  } else {
    // User is not logged in
    if (isIndexPage) {
      // Redirect to login if on index page
      window.location.href = 'login.html';
    }
    // If on login page, user needs to log in, so do nothing
    console.log("Not logged in");
  }
  
  // Set up login/signup tab switching if on login page
  if (isLoginPage) {
    setupAuthTabs();
    setupAuthForms();
  }
});

// Setup for switching between login and signup tabs
function setupAuthTabs() {
  const loginTab = document.getElementById('login-tab');
  const signupTab = document.getElementById('signup-tab');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  
  loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    loginForm.classList.add('active');
    signupForm.classList.remove('active');
  });
  
  signupTab.addEventListener('click', () => {
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    signupForm.classList.add('active');
    loginForm.classList.remove('active');
  });
}

// Setup for handling form submissions
function setupAuthForms() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginError = document.getElementById('login-error');
  const signupError = document.getElementById('signup-error');
  
  // Handle Login Form Submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
      loginError.textContent = '';
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      // Successful login, redirect to index page
      window.location.href = 'index.html';
    } catch (error) {
      console.error('Error logging in:', error.message);
      loginError.textContent = error.message || 'Failed to log in. Please try again.';
    }
  });
  
  // Handle Signup Form Submission
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    try {
      signupError.textContent = '';
      
      // Register new user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username
          }
        }
      });
      
      if (error) throw error;
      
      // If signUp was successful
      if (data.user) {
        // Check if email confirmation is required
        if (data.session) {
          // User is automatically signed in - redirect to index
          window.location.href = 'index.html';
        } else {
          // Email confirmation required
          signupForm.innerHTML = `<div class="success-message">
            <h3>Registration Successful!</h3>
            <p>Please check your email to confirm your account before logging in.</p>
            <button class="auth-submit" onclick="document.getElementById('login-tab').click()">
              Go to Login
            </button>
          </div>`;
        }
      }
    } catch (error) {
      console.error('Error signing up:', error.message);
      signupError.textContent = error.message || 'Failed to sign up. Please try again.';
    }
  });
}

// Logout functionality - can be called from any page
async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Error logging out:', error.message);
    alert('Failed to log out. Please try again.');
  }
}

// Make logout function globally available
window.logout = logout;
