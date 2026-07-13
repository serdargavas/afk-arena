use std::fs;

// Bake the Google OAuth client id/secret from the gitignored repo-root .env into
// the binary via env! at compile time. Kept out of the JS bundle on purpose; a
// desktop OAuth secret is not treated as confidential by Google. Missing .env →
// empty strings, and the sign-in command reports "not configured" at runtime.
fn main() {
    let (mut cid, mut secret) = (String::new(), String::new());
    if let Ok(env) = fs::read_to_string("../.env") {
        for line in env.lines() {
            let line = line.trim();
            if let Some(v) = line.strip_prefix("GOOGLE_CLIENT_ID=") {
                cid = v.trim().to_string();
            } else if let Some(v) = line.strip_prefix("GOOGLE_CLIENT_SECRET=") {
                secret = v.trim().to_string();
            }
        }
    }
    println!("cargo:rustc-env=GOOGLE_CLIENT_ID={cid}");
    println!("cargo:rustc-env=GOOGLE_CLIENT_SECRET={secret}");
    println!("cargo:rerun-if-changed=../.env");
    tauri_build::build()
}
