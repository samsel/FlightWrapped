use oauth2::basic::BasicClient;
use oauth2::{
    AuthUrl, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge, RedirectUrl, Scope,
    TokenResponse, TokenUrl,
};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use tauri::Emitter;
use tauri::Manager;
use url::Url;

#[derive(Serialize, Deserialize, Clone)]
pub struct AuthResult {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub id_token: Option<String>,
}

#[tauri::command]
pub async fn start_google_auth(app: tauri::AppHandle) -> Result<AuthResult, String> {
    #[derive(Deserialize)]
    struct Secrets {
        client_id: String,
        client_secret: String,
    }

    let secrets_json = include_str!("../secrets.json");
    let secrets: Secrets = serde_json::from_str(secrets_json)
        .map_err(|e| format!("Failed to parse secrets.json: {}", e))?;

    let google_client_id = ClientId::new(secrets.client_id);
    let google_client_secret = ClientSecret::new(secrets.client_secret);

    let auth_url = AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string())
        .map_err(|e| e.to_string())?;
    let token_url = TokenUrl::new("https://oauth2.googleapis.com/token".to_string())
        .map_err(|e| e.to_string())?;

    // Bind to a random port on localhost
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let redirect_url = RedirectUrl::new(format!("http://127.0.0.1:{}/auth/callback", port))
        .map_err(|e| e.to_string())?;

    let client = BasicClient::new(google_client_id)
        .set_client_secret(google_client_secret)
        .set_auth_uri(auth_url)
        .set_token_uri(token_url)
        .set_redirect_uri(redirect_url);

    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

    let (authorize_url, csrf_state) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new(
            "https://www.googleapis.com/auth/gmail.readonly".to_string(),
        ))
        .set_pkce_challenge(pkce_challenge)
        .url();

    // Open the browser
    if let Some(shell) = app.get_webview_window("main") {
        // Using shell plugin to open
        // Ideally use tauri_plugin_shell::ShellExt or just simple open if available
        // Actually, we can use the `tauri_plugin_shell` api from JS or Rust.
        // In Rust, we can emit an event or use the scanner.
        // Let's use the shell plugin via the AppHandle if possible, or just std::process for macOS open command
        // which is "open" command.
        // Better: use the plugin properly.
        // But for simplicity in this function, I will just use `open` crate or simpler:
        // `tauri::async_runtime::spawn` to call shell open.
        // Wait, `tauri-plugin-opener` usually handles `open`.
        // Let's use `tauri_plugin_opener`
    }
    // We can just use the shell plugin api if we have access, but simpler is to return the URL for frontend to open?
    // No, we want to start listening BEFORE opening.

    // Let's use `open` crate logic:
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(authorize_url.as_str())
        .spawn()
        .map_err(|e| e.to_string())?;

    // Wait for the code
    let mut stream = listener
        .incoming()
        .next()
        .ok_or("Listener closed")?
        .map_err(|e| e.to_string())?;

    let mut reader = BufReader::new(&stream);
    let mut request_line = String::new();
    reader
        .read_line(&mut request_line)
        .map_err(|e| e.to_string())?;

    let redirect_url = request_line
        .split_whitespace()
        .nth(1)
        .ok_or("Invalid request")?;

    let url =
        Url::parse(&format!("http://localhost{}", redirect_url)).map_err(|e| e.to_string())?;

    let code_pair = url
        .query_pairs()
        .find(|(key, _)| key == "code")
        .ok_or("No code in callback")?;

    let code = oauth2::AuthorizationCode::new(code_pair.1.into_owned());

    let state_pair = url
        .query_pairs()
        .find(|(key, _)| key == "state")
        .ok_or("No state in callback")?;

    if state_pair.1 != *csrf_state.secret() {
        return Err("Invalid state".to_string());
    }

    // Exchange the code with a POST request to the token URL
    let http_client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;

    let token_result = client
        .exchange_code(code)
        .set_pkce_verifier(pkce_verifier)
        .request_async(&http_client)
        .await
        .map_err(|e| e.to_string())?;

    // Send success response to browser
    let response = "HTTP/1.1 200 OK\r\n\r\n<html><body><h1>Authentication Successful!</h1><p>You can close this tab and return to the app.</p><script>window.close()</script></body></html>";
    stream
        .write_all(response.as_bytes())
        .map_err(|e| e.to_string())?;

    Ok(AuthResult {
        access_token: token_result.access_token().secret().clone(),
        refresh_token: token_result.refresh_token().map(|t| t.secret().clone()),
        id_token: None, // Oauth2 crate might not parse id_token automatically in BasicTokenResponse depending on features, but we mainly need access token.
    })
}
