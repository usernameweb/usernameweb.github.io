// Authentication utility functions

async function checkAuthAndRedirect() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            // User is logged in, redirect to dashboard
            window.location.href = '../';
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
}

async function requireAuth() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            // User is not logged in, redirect to login
            window.location.href = './login/';
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = './login/';
        return false;
    }
}

async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (!error) {
        window.location.href = './login/';
    }
    return error;
}

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        // Only redirect if not already on auth pages
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/login/') && 
            !currentPath.includes('/signup/') && 
            !currentPath.includes('/forget-password/')) {
            window.location.href = './login/';
        }
    }
});