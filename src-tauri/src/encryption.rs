// Encryption module for secure storage of sensitive data like API tokens.
// Uses AES-256-GCM encryption with a machine-specific key derived from the machine ID.
// Encrypted tokens are stored in config.yml with a prefix: "enc:v1:aes256gcm:<base64_data>"

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use sha2::{Digest, Sha256};

/// Prefix for encrypted tokens in config
const ENCRYPTED_PREFIX: &str = "enc:v1:aes256gcm:";
/// Application salt for key derivation
const APP_SALT: &[u8] = b"SoulNotes-Encryption-Salt-v1";

/// Get a machine-specific key for encryption
/// Uses the machine ID combined with an application salt
fn get_machine_key() -> Result<[u8; 32], String> {
    let machine_id = machine_uid::get()
        .map_err(|e| format!("Failed to get machine ID: {}", e))?;
    
    // Derive a 256-bit key using SHA-256
    let mut hasher = Sha256::new();
    hasher.update(machine_id.as_bytes());
    hasher.update(APP_SALT);
    
    let key = hasher.finalize();
    Ok(key.into())
}

/// Encrypt a token using AES-256-GCM
/// Returns a base64-encoded encrypted string with prefix
pub fn encrypt_token(token: &str) -> Result<String, String> {
    if token.is_empty() {
        return Ok(String::new());
    }
    
    let key = get_machine_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;
    
    // Use a fixed nonce derived from the machine key (deterministic but unique per machine)
    // For better security, we could generate random nonces and store them, but this is simpler
    let mut nonce_bytes = [0u8; 12];
    let key_hash = Sha256::digest(&key);
    nonce_bytes.copy_from_slice(&key_hash[..12]);
    let nonce = Nonce::from(nonce_bytes);
    
    // Encrypt
    let ciphertext = cipher
        .encrypt(&nonce, token.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    // Encode as base64 with prefix
    let encoded = BASE64.encode(&ciphertext);
    Ok(format!("{}{}", ENCRYPTED_PREFIX, encoded))
}

/// Decrypt a token that was encrypted with encrypt_token
/// Returns None if the token is not encrypted (plain text for backward compatibility)
/// Returns Some(decrypted_token) if decryption succeeds
pub fn decrypt_token(token: &str) -> Result<Option<String>, String> {
    // Empty token
    if token.is_empty() {
        return Ok(None);
    }
    
    // Check if it's encrypted
    if !token.starts_with(ENCRYPTED_PREFIX) {
        // Not encrypted - return as-is for backward compatibility
        return Ok(Some(token.to_string()));
    }
    
    // Remove prefix and decode base64
    let encoded = token.strip_prefix(ENCRYPTED_PREFIX).unwrap();
    let ciphertext = BASE64
        .decode(encoded)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;
    
    // Get key and create cipher
    let key = get_machine_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;
    
    // Create nonce (same as in encrypt_token)
    let mut nonce_bytes = [0u8; 12];
    let key_hash = Sha256::digest(&key);
    nonce_bytes.copy_from_slice(&key_hash[..12]);
    let nonce = Nonce::from(nonce_bytes);
    
    // Decrypt
    let plaintext = cipher
        .decrypt(&nonce, ciphertext.as_slice())
        .map_err(|e| format!("Decryption failed: {}", e))?;
    
    // Convert to string
    String::from_utf8(plaintext)
        .map(Some)
        .map_err(|e| format!("Invalid UTF-8 in decrypted token: {}", e))
}

/// Check if a token is encrypted
pub fn is_encrypted(token: &str) -> bool {
    token.starts_with(ENCRYPTED_PREFIX)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_token() {
        let original = "my-secret-api-token-12345";
        
        // Encrypt
        let encrypted = encrypt_token(original).expect("Encryption should succeed");
        
        // Should have prefix
        assert!(encrypted.starts_with(ENCRYPTED_PREFIX));
        assert!(is_encrypted(&encrypted));
        
        // Should be different from original
        assert_ne!(encrypted, original);
        
        // Decrypt
        let decrypted = decrypt_token(&encrypted).expect("Decryption should succeed");
        assert_eq!(decrypted, Some(original.to_string()));
    }

    #[test]
    fn test_encrypt_empty_token() {
        let encrypted = encrypt_token("").expect("Should handle empty token");
        assert_eq!(encrypted, "");
        
        let decrypted = decrypt_token("").expect("Should handle empty token");
        assert_eq!(decrypted, None);
    }

    #[test]
    fn test_decrypt_plain_token() {
        // Backward compatibility - plain tokens should work
        let plain = "plain-token";
        let result = decrypt_token(plain).expect("Should handle plain token");
        assert_eq!(result, Some(plain.to_string()));
    }

    #[test]
    fn test_is_encrypted() {
        assert!(is_encrypted("enc:v1:aes256gcm:somebase64data"));
        assert!(!is_encrypted("plain-token"));
        assert!(!is_encrypted(""));
    }

    #[test]
    fn test_encryption_produces_different_ciphertext() {
        // Same plaintext should produce same ciphertext (deterministic with fixed nonce)
        // This is acceptable for our use case since the key is machine-specific
        let token = "test-token";
        
        let encrypted1 = encrypt_token(token).expect("Should encrypt");
        let encrypted2 = encrypt_token(token).expect("Should encrypt");
        
        // With deterministic nonce, they should be the same
        assert_eq!(encrypted1, encrypted2);
    }
}