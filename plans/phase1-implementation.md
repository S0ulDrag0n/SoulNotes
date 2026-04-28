# Phase 1 Implementation Specifications

## Overview

Phase 1 implements the foundational infrastructure for premium features:
- Mode-switching header with page routing
- License validation system (Rust/WASM)
- Vocabulary capture and storage
- Multi-language deck support
- TTS audio generation via Speaches
- Basic flashcard review mode

---

## 1. Project Structure Changes

### New Files to Create

```
src/
├── app/
│   ├── conversation/
│   │   └── page.tsx              # Conversation mode page (premium)
│   ├── flashcards/
│   │   └── page.tsx              # Flashcard review page
│   ├── dashboard/
│   │   └── page.tsx              # Dashboard page (premium)
│   └── api/
│       ├── tts/
│       │   └── route.ts          # TTS endpoint
│       └── license/
│           └── route.ts          # License validation bridge
├── components/
│   ├── AppHeader.tsx             # Mode-switching header
│   ├── ModeTab.tsx               # Individual tab component
│   ├── LicenseModal.tsx          # License entry modal
│   ├── PremiumGate.tsx           # Premium feature wrapper
│   ├── VocabularyPanel.tsx       # Vocabulary list management
│   ├── FlashcardReview.tsx       # Review session UI
│   ├── LanguageDeckSelector.tsx  # Deck switching dropdown
│   └── WordCapture.tsx           # Click-to-save word component
├── hooks/
│   ├── useLicense.ts             # License state management
│   ├── useVocabulary.ts          # Vocabulary CRUD operations
│   ├── useFlashcards.ts          # SRS logic and review state
│   └── useTTS.ts                 # TTS audio generation
├── lib/
│   ├── license.ts                # License bridge (platform detection)
│   ├── vocabulary-db.ts          # IndexedDB vocabulary storage
│   ├── srs.ts                    # Spaced repetition algorithm
│   └── constants.ts              # Updated with new constants
└── types/
    └── vocabulary.ts             # Vocabulary-related types

src-tauri/
└── src/
    ├── license.rs                # Rust license validation
    ├── vocabulary.rs             # Rust vocabulary storage (SQLite)
    └── lib.rs                    # Updated with new commands

src-wasm/                         # NEW: WASM for web license
├── Cargo.toml
└── src/
    └── lib.rs                    # WASM license validation
```

---

## 2. License Validation System

### 2.1 License Key Format

```typescript
// Format: SOULNOTES-XXXX-XXXX-XXXX-XXXX
// Example: SOULNOTES-A7B2-K9M4-P3Q8-R1T5

interface LicenseData {
  version: 1;                    // Key format version
  keyId: string;                 // Unique key identifier (8 chars)
  tier: 'premium';               // License tier
  features: string[];            // Enabled features
  issuedAt: number;              // Unix timestamp
  expiresAt: null;               // null = lifetime
}
```

### 2.2 Rust Implementation (Desktop)

```rust
// src-tauri/src/license.rs

use ed25519_dalek::{PublicKey, Signature, Verifier, SignatureError};
use base32::{decode, Alphabet};
use serde::{Serialize, Deserialize};

const PUBLIC_KEY_BYTES: &[u8; 32] = include_bytes!("../public_key.bin");

#[derive(Debug, Serialize, Deserialize)]
pub struct License {
    pub key_id: String,
    pub tier: String,
    pub features: Vec<String>,
    pub issued_at: u64,
}

#[derive(Debug, Serialize)]
pub struct LicenseError {
    pub message: String,
}

impl From<SignatureError> for LicenseError {
    fn from(_: SignatureError) -> Self {
        LicenseError {
            message: "Invalid license signature".to_string(),
        }
    }
}

impl From<base32::DecodeError> for LicenseError {
    fn from(_: base32::DecodeError) -> Self {
        LicenseError {
            message: "Invalid license format".to_string(),
        }
    }
}

/// Validate a license key
pub fn validate_license(key: &str) -> Result<License, LicenseError> {
    // 1. Clean and parse key format
    let clean_key = key
        .to_uppercase()
        .replace("SOULNOTES-", "")
        .replace("-", "");
    
    if clean_key.len() != 16 {
        return Err(LicenseError {
            message: "Invalid key length".to_string(),
        });
    }

    // 2. Decode base32
    let decoded = decode(Alphabet::RFC4648 { padding: false }, &clean_key)
        .ok_or_else(|| LicenseError {
            message: "Invalid key encoding".to_string(),
        })?;

    // 3. Split into data and signature (last 64 bytes are signature)
    if decoded.len() < 65 {
        return Err(LicenseError {
            message: "Invalid key structure".to_string(),
        });
    }
    
    let data = &decoded[..decoded.len() - 64];
    let signature_bytes = &decoded[decoded.len() - 64..];

    // 4. Verify Ed25519 signature
    let public_key = PublicKey::from_bytes(PUBLIC_KEY_BYTES)?;
    let signature = Signature::from_bytes(signature_bytes.try_into().unwrap());
    
    public_key.verify(data, &signature)?;

    // 5. Parse license data (simple binary format)
    let license = parse_license_data(data)?;

    Ok(license)
}

fn parse_license_data(data: &[u8]) -> Result<License, LicenseError> {
    // Binary format:
    // [1 byte version] [8 bytes key_id] [1 byte tier] [4 bytes issued_at]
    if data.len() < 14 {
        return Err(LicenseError {
            message: "Invalid license data".to_string(),
        });
    }

    let version = data[0];
    if version != 1 {
        return Err(LicenseError {
            message: "Unsupported license version".to_string(),
        });
    }

    let key_id = base32::encode(Alphabet::RFC4648 { padding: false }, &data[1..9]);
    let tier = match data[9] {
        0 => "premium".to_string(),
        _ => return Err(LicenseError {
            message: "Invalid tier".to_string(),
        }),
    };
    
    let issued_at = u32::from_be_bytes([data[10], data[11], data[12], data[13]]) as u64;

    Ok(License {
        key_id,
        tier,
        features: vec!["conversation".to_string(), "dashboard".to_string(), "unlimited_vocabulary".to_string()],
        issued_at,
    })
}

/// Store license in secure storage
pub fn store_license(license: &License) -> Result<(), String> {
    // Use Tauri's secure storage (OS keychain)
    // Implementation depends on tauri-plugin-store
    todo!("Implement secure storage")
}

/// Retrieve stored license
pub fn get_stored_license() -> Option<License> {
    todo!("Implement secure storage retrieval")
}

/// Check if premium features are enabled
pub fn is_premium() -> bool {
    get_stored_license().is_some()
}
```

### 2.3 Tauri Commands

```rust
// src-tauri/src/lib.rs (additions)

mod license;
mod vocabulary;

use license::{validate_license, is_premium, get_stored_license, License, LicenseError};
use vocabulary::{VocabularyStore, VocabularyItem, LanguageDeck};

#[tauri::command]
fn activate_license(key: String) -> Result<License, String> {
    validate_license(&key)
        .and_then(|license| {
            license::store_license(&license)?;
            Ok(license)
        })
        .map_err(|e| e.message)
}

#[tauri::command]
fn check_premium_status() -> bool {
    is_premium()
}

#[tauri::command]
fn get_license_info() -> Option<License> {
    get_stored_license()
}

#[tauri::command]
fn deactivate_license() -> Result<(), String> {
    license::remove_license()
}

// Vocabulary commands
#[tauri::command]
async fn get_decks() -> Result<Vec<LanguageDeck>, String> {
    // ...
}

#[tauri::command]
async fn create_deck(language: String, name: String) -> Result<LanguageDeck, String> {
    // ...
}

#[tauri::command]
async fn add_vocabulary_item(
    deck_id: String,
    word: String,
    translation: String,
    context: String,
) -> Result<VocabularyItem, String> {
    // ...
}

// ... more vocabulary commands
```

### 2.4 WASM Implementation (Web)

```rust
// src-wasm/Cargo.toml

[package]
name = "soulnotes-wasm"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
ed25519-dalek = "2.0"
base32 = "0.4"
serde = { version = "1.0", features = ["derive"] }
serde-wasm-bindgen = "0.6"
js-sys = "0.3"

[profile.release]
opt-level = "s"
```

```rust
// src-wasm/src/lib.rs

use wasm_bindgen::prelude::*;
use ed25519_dalek::{PublicKey, Signature, Verifier};
use base32::{decode, Alphabet};
use serde::{Serialize, Deserialize};

const PUBLIC_KEY_BYTES: &[u8; 32] = include_bytes!("../public_key.bin");

#[derive(Serialize, Deserialize)]
pub struct License {
    pub key_id: String,
    pub tier: String,
    pub features: Vec<String>,
    pub issued_at: u64,
}

#[wasm_bindgen]
pub fn validate_license_wasm(key: String) -> Result<JsValue, JsValue> {
    // Same validation logic as desktop
    let clean_key = key
        .to_uppercase()
        .replace("SOULNOTES-", "")
        .replace("-", "");
    
    if clean_key.len() != 16 {
        return Err(JsValue::from_str("Invalid key length"));
    }

    let decoded = decode(Alphabet::RFC4648 { padding: false }, &clean_key)
        .ok_or_else(|| JsValue::from_str("Invalid key encoding"))?;

    if decoded.len() < 65 {
        return Err(JsValue::from_str("Invalid key structure"));
    }
    
    let data = &decoded[..decoded.len() - 64];
    let signature_bytes = &decoded[decoded.len() - 64..];

    let public_key = PublicKey::from_bytes(PUBLIC_KEY_BYTES)
        .map_err(|_| JsValue::from_str("Invalid public key"))?;
    let signature = Signature::from_bytes(signature_bytes.try_into().unwrap())
        .map_err(|_| JsValue::from_str("Invalid signature format"))?;
    
    public_key.verify(data, &signature)
        .map_err(|_| JsValue::from_str("Invalid license signature"))?;

    let license = parse_license_data(data)
        .map_err(|e| JsValue::from_str(&e))?;

    Ok(serde_wasm_bindgen::to_value(&license)
        .map_err(|_| JsValue::from_str("Serialization error"))?)
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

fn parse_license_data(data: &[u8]) -> Result<License, String> {
    if data.len() < 14 {
        return Err("Invalid license data".to_string());
    }

    let version = data[0];
    if version != 1 {
        return Err("Unsupported license version".to_string());
    }

    let key_id = base32::encode(Alphabet::RFC4648 { padding: false }, &data[1..9]);
    let tier = match data[9] {
        0 => "premium".to_string(),
        _ => return Err("Invalid tier".to_string()),
    };
    
    let issued_at = u32::from_be_bytes([data[10], data[11], data[12], data[13]]) as u64;

    Ok(License {
        key_id,
        tier,
        features: vec!["conversation".to_string(), "dashboard".to_string(), "unlimited_vocabulary".to_string()],
        issued_at,
    })
}
```

### 2.5 Frontend License Bridge

```typescript
// src/lib/license.ts

import { isDesktop } from './platform';

export interface License {
  keyId: string;
  tier: string;
  features: string[];
  issuedAt: number;
}

export interface LicenseValidation {
  isValid: boolean;
  license?: License;
  error?: string;
}

// Dynamically load WASM module for web
let wasmModule: typeof import('soulnotes-wasm') | null = null;

async function getWasmModule() {
  if (!wasmModule) {
    wasmModule = await import('soulnotes-wasm');
    wasmModule.init_panic_hook();
  }
  return wasmModule;
}

/**
 * Validate a license key
 * Uses Rust (Tauri) on desktop, WASM on web
 */
export async function validateLicense(key: string): Promise<LicenseValidation> {
  if (isDesktop()) {
    // Desktop: Use Tauri command
    const { invoke } = await import('@tauri-apps/api/tauri');
    try {
      const license = await invoke<License>('activate_license', { key });
      return { isValid: true, license };
    } catch (error) {
      return { isValid: false, error: String(error) };
    }
  } else {
    // Web: Use WASM
    try {
      const wasm = await getWasmModule();
      const license = wasm.validate_license_wasm(key);
      // Store in IndexedDB
      await storeLicenseInIndexedDB(license as License);
      return { isValid: true, license: license as License };
    } catch (error) {
      return { isValid: false, error: String(error) };
    }
  }
}

/**
 * Check if premium features are enabled
 */
export async function checkPremiumStatus(): Promise<boolean> {
  if (isDesktop()) {
    const { invoke } = await import('@tauri-apps/api/tauri');
    return invoke<boolean>('check_premium_status');
  } else {
    const license = await getStoredLicenseFromIndexedDB();
    return license !== null;
  }
}

/**
 * Get stored license info
 */
export async function getLicenseInfo(): Promise<License | null> {
  if (isDesktop()) {
    const { invoke } = await import('@tauri-apps/api/tauri');
    return invoke<License | null>('get_license_info');
  } else {
    return getStoredLicenseFromIndexedDB();
  }
}

/**
 * Deactivate license
 */
export async function deactivateLicense(): Promise<void> {
  if (isDesktop()) {
    const { invoke } = await import('@tauri-apps/api/tauri');
    await invoke('deactivate_license');
  } else {
    await removeLicenseFromIndexedDB();
  }
}

// IndexedDB helpers for web
const DB_NAME = 'soulnotes-license';
const STORE_NAME = 'license';

async function storeLicenseInIndexedDB(license: License): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(license, 'current');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

async function getStoredLicenseFromIndexedDB(): Promise<License | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get('current');
      
      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => reject(getRequest.error);
    };
  });
}

async function removeLicenseFromIndexedDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete('current');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
  });
}
```

### 2.6 License Hook

```typescript
// src/hooks/useLicense.ts

import { useState, useEffect, useCallback } from 'react';
import { 
  validateLicense, 
  checkPremiumStatus, 
  getLicenseInfo, 
  deactivateLicense,
  type License 
} from '@/lib/license';

interface UseLicenseReturn {
  isPremium: boolean;
  license: License | null;
  isLoading: boolean;
  error: string | null;
  activate: (key: string) => Promise<boolean>;
  deactivate: () => Promise<void>;
  checkStatus: () => Promise<void>;
}

export function useLicense(): UseLicenseReturn {
  const [isPremium, setIsPremium] = useState(false);
  const [license, setLicense] = useState<License | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const premium = await checkPremiumStatus();
      setIsPremium(premium);
      
      if (premium) {
        const info = await getLicenseInfo();
        setLicense(info);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const activate = useCallback(async (key: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    const result = await validateLicense(key);
    
    if (result.isValid && result.license) {
      setIsPremium(true);
      setLicense(result.license);
      setIsLoading(false);
      return true;
    } else {
      setError(result.error || 'Invalid license key');
      setIsLoading(false);
      return false;
    }
  }, []);

  const deactivate = useCallback(async () => {
    await deactivateLicense();
    setIsPremium(false);
    setLicense(null);
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    isPremium,
    license,
    isLoading,
    error,
    activate,
    deactivate,
    checkStatus,
  };
}
```

---

## 3. Mode-Switching Header

### 3.1 AppHeader Component

```typescript
// src/components/AppHeader.tsx

'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useLicense } from '@/hooks/useLicense';
import { ModeTab } from './ModeTab';
import { LicenseModal } from './LicenseModal';
import { useState } from 'react';

const MODES = [
  { 
    id: 'transcribe', 
    label: 'Transcribe', 
    icon: '🎤', 
    path: '/',
    premium: false 
  },
  { 
    id: 'conversation', 
    label: 'Conversation', 
    icon: '💬', 
    path: '/conversation',
    premium: true 
  },
  { 
    id: 'flashcards', 
    label: 'Flashcards', 
    icon: '📚', 
    path: '/flashcards',
    premium: false 
  },
  { 
    id: 'dashboard', 
    label: 'Dashboard', 
    icon: '📊', 
    path: '/dashboard',
    premium: true 
  },
] as const;

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { isPremium, license } = useLicense();
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const handleModeClick = (path: string, isPremiumMode: boolean) => {
    if (isPremiumMode && !isPremium) {
      setPendingPath(path);
      setShowLicenseModal(true);
      return;
    }
    router.push(path);
  };

  const handleLicenseSuccess = () => {
    setShowLicenseModal(false);
    if (pendingPath) {
      router.push(pendingPath);
      setPendingPath(null);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-[#15120d]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
              SoulNotes
            </span>
            {isPremium && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                Premium
              </span>
            )}
          </div>

          {/* Mode Tabs */}
          <nav className="flex gap-1">
            {MODES.map((mode) => (
              <ModeTab
                key={mode.id}
                label={mode.label}
                icon={mode.icon}
                isActive={pathname === mode.path}
                isPremium={mode.premium}
                isUnlocked={!mode.premium || isPremium}
                onClick={() => handleModeClick(mode.path, mode.premium)}
              />
            ))}
          </nav>

          {/* License Button */}
          {!isPremium && (
            <button
              onClick={() => setShowLicenseModal(true)}
              className="rounded-lg bg-[#1f1c16] px-3 py-1.5 text-sm font-medium text-[#f6e9cc] transition hover:bg-[#342d22] dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
            >
              Upgrade
            </button>
          )}
        </div>
      </header>

      <LicenseModal
        isOpen={showLicenseModal}
        onClose={() => setShowLicenseModal(false)}
        onSuccess={handleLicenseSuccess}
      />
    </>
  );
}
```

### 3.2 ModeTab Component

```typescript
// src/components/ModeTab.tsx

interface ModeTabProps {
  label: string;
  icon: string;
  isActive: boolean;
  isPremium: boolean;
  isUnlocked: boolean;
  onClick: () => void;
}

export function ModeTab({
  label,
  icon,
  isActive,
  isPremium,
  isUnlocked,
  onClick,
}: ModeTabProps) {
  return (
    <button
      onClick={onClick}
      disabled={!isUnlocked}
      className={`
        flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition
        ${isActive
          ? 'bg-[#1f1c16] text-[#f6e9cc] dark:bg-[#f6e9cc] dark:text-[#1f1c16]'
          : isUnlocked
            ? 'text-[#5c4d39] hover:bg-[#efe0c3] dark:text-[#d6c5ad] dark:hover:bg-[#2a2218]'
            : 'cursor-not-allowed text-[#a08a68] dark:text-[#6b5a3f]'
        }
      `}
      title={!isUnlocked ? 'Premium feature - Upgrade to unlock' : label}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      {isPremium && !isUnlocked && (
        <span className="text-xs">🔒</span>
      )}
    </button>
  );
}
```

### 3.3 PremiumGate Component

```typescript
// src/components/PremiumGate.tsx

'use client';

import { useLicense } from '@/hooks/useLicense';
import { LicenseModal } from './LicenseModal';
import { useState, useEffect } from 'react';

interface PremiumGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PremiumGate({ children, fallback }: PremiumGateProps) {
  const { isPremium, isLoading } = useLicense();
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1f1c16] border-t-transparent dark:border-[#f6e9cc]" />
      </div>
    );
  }

  if (!isPremium) {
    return (
      <>
        {fallback || (
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl border border-black/10 bg-white/80 p-8 dark:border-white/10 dark:bg-[#15120d]/85">
            <div className="text-4xl">🔒</div>
            <h2 className="text-xl font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
              Premium Feature
            </h2>
            <p className="max-w-md text-center text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
              This feature requires a premium license. Upgrade to unlock AI conversation
              partner, unlimited vocabulary, and more.
            </p>
            <button
              onClick={() => setShowLicenseModal(true)}
              className="rounded-lg bg-[#1f1c16] px-6 py-2 text-sm font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
            >
              Enter License Key
            </button>
          </div>
        )}
        <LicenseModal
          isOpen={showLicenseModal}
          onClose={() => setShowLicenseModal(false)}
          onSuccess={() => setShowLicenseModal(false)}
        />
      </>
    );
  }

  return <>{children}</>;
}
```

### 3.4 LicenseModal Component

```typescript
// src/components/LicenseModal.tsx

'use client';

import { useState } from 'react';
import { useLicense } from '@/hooks/useLicense';

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LicenseModal({ isOpen, onClose, onSuccess }: LicenseModalProps) {
  const { activate, isLoading, error } = useLicense();
  const [key, setKey] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanKey = key.trim().toUpperCase();
    if (!cleanKey.startsWith('SOULNOTES-')) {
      setLocalError('Invalid key format. Key should start with SOULNOTES-');
      return;
    }

    const success = await activate(cleanKey);
    if (success) {
      onSuccess();
    }
  };

  const formatKey = (value: string) => {
    // Auto-format as user types: SOULNOTES-XXXX-XXXX-XXXX-XXXX
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (cleaned.length <= 10) {
      return cleaned;
    }
    
    const prefix = 'SOULNOTES';
    const rest = cleaned.slice(10);
    const groups = rest.match(/.{1,4}/g) || [];
    
    return `${prefix}-${groups.join('-')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#1a1611]">
        <h2 className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
          Activate Premium
        </h2>
        <p className="mt-2 text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
          Enter your license key to unlock premium features.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#5c4d39] dark:text-[#d6c5ad]">
              License Key
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(formatKey(e.target.value))}
              placeholder="SOULNOTES-XXXX-XXXX-XXXX-XXXX"
              className="mt-1 w-full rounded-lg border border-[#d7c7a7] bg-white px-3 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
              maxLength={29}
            />
          </div>

          {(error || localError) && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {localError || error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#d7c7a7] px-4 py-2 text-sm font-medium text-[#5c4d39] transition hover:bg-[#efe0c3] dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || key.length < 29}
              className="flex-1 rounded-lg bg-[#1f1c16] px-4 py-2 text-sm font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
            >
              {isLoading ? 'Activating...' : 'Activate'}
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-[#8b7a5a] dark:text-[#6b5a3f]">
          Premium features include: AI Conversation Partner, unlimited vocabulary,
          progress dashboard, and more.
        </p>
      </div>
    </div>
  );
}
```

---

## 4. Vocabulary System

### 4.1 Types

```typescript
// src/types/vocabulary.ts

export interface LanguageDeck {
  id: string;
  language: string;
  name: string;
  createdAt: Date;
  lastReviewedAt?: Date;
  stats: DeckStats;
}

export interface DeckStats {
  totalWords: number;
  wordsLearned: number;
  dueToday: number;
}

export interface VocabularyItem {
  id: string;
  deckId: string;
  word: string;
  language: string;
  translation: string;
  definition?: string;
  context: string;
  source: 'transcript' | 'translation' | 'conversation' | 'manual';
  createdAt: Date;
  audioUrl?: string;
  tags: string[];
}

export interface Flashcard {
  id: string;
  vocabularyId: string;
  type: CardType;
  front: string;
  back: string;
  // SRS fields
  ease: number;
  interval: number;
  dueDate: Date;
  reviewCount: number;
  lapseCount: number;
}

export type CardType = 'basic' | 'reverse' | 'context' | 'audio';

export interface ReviewResult {
  cardId: string;
  rating: 'again' | 'hard' | 'good' | 'easy';
  reviewedAt: Date;
}

// Free tier limits
export const FREE_TIER_LIMITS = {
  maxWordsPerDeck: 25,
} as const;
```

### 4.2 SRS Algorithm

```typescript
// src/lib/srs.ts

/**
 * SM-2 Spaced Repetition Algorithm
 * Based on Anki's implementation
 */

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;
const EASE_MODIFIER = 0.15;

// Interval modifiers
const AGAIN_INTERVAL = 1; // 1 day
const HARD_INTERVAL_MULTIPLIER = 1.2;
const EASY_INTERVAL_MULTIPLIER = 2.5;
const GRADUATING_INTERVAL = 1; // 1 day for new cards

export interface SRSCard {
  ease: number;
  interval: number;
  dueDate: Date;
  reviewCount: number;
  lapseCount: number;
}

export type Rating = 'again' | 'hard' | 'good' | 'easy';

/**
 * Calculate next review date based on rating
 */
export function calculateNextReview(card: SRSCard, rating: Rating): SRSCard {
  const now = new Date();
  let newEase = card.ease;
  let newInterval = card.interval;
  let newLapseCount = card.lapseCount;

  switch (rating) {
    case 'again':
      // Reset interval, decrease ease, increment lapse
      newInterval = AGAIN_INTERVAL;
      newEase = Math.max(MIN_EASE, card.ease - 0.2);
      newLapseCount = card.lapseCount + 1;
      break;

    case 'hard':
      // Small interval increase, decrease ease
      newInterval = Math.max(1, Math.floor(card.interval * HARD_INTERVAL_MULTIPLIER));
      newEase = Math.max(MIN_EASE, card.ease - EASE_MODIFIER);
      break;

    case 'good':
      // Standard interval increase
      if (card.reviewCount === 0) {
        newInterval = GRADUATING_INTERVAL;
      } else if (card.interval === 0) {
        newInterval = 1;
      } else {
        newInterval = Math.floor(card.interval * card.ease);
      }
      break;

    case 'easy':
      // Large interval increase, increase ease
      if (card.reviewCount === 0) {
        newInterval = 4; // 4 days for easy on new card
      } else {
        newInterval = Math.floor(card.interval * card.ease * EASY_INTERVAL_MULTIPLIER);
      }
      newEase = card.ease + EASE_MODIFIER;
      break;
  }

  // Calculate next due date
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + newInterval);

  return {
    ease: newEase,
    interval: newInterval,
    dueDate,
    reviewCount: card.reviewCount + 1,
    lapseCount: newLapseCount,
  };
}

/**
 * Get cards due for review today
 */
export function getDueCards(cards: SRSCard[]): SRSCard[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  return cards.filter(card => new Date(card.dueDate) <= now);
}

/**
 * Initialize a new card for SRS
 */
export function initializeNewCard(): SRSCard {
  const now = new Date();
  return {
    ease: DEFAULT_EASE,
    interval: 0,
    dueDate: now,
    reviewCount: 0,
    lapseCount: 0,
  };
}
```

### 4.3 Vocabulary Database (IndexedDB for Web)

```typescript
// src/lib/vocabulary-db.ts

import type { LanguageDeck, VocabularyItem, Flashcard } from '@/types/vocabulary';

const DB_NAME = 'soulnotes-vocabulary';
const DB_VERSION = 1;

interface VocabularyDB {
  decks: LanguageDeck[];
  items: VocabularyItem[];
  flashcards: Flashcard[];
}

class VocabularyDatabase {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Decks store
        if (!db.objectStoreNames.contains('decks')) {
          const deckStore = db.createObjectStore('decks', { keyPath: 'id' });
          deckStore.createIndex('language', 'language', { unique: false });
        }

        // Items store
        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('deckId', 'deckId', { unique: false });
          itemStore.createIndex('word', 'word', { unique: false });
          itemStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Flashcards store
        if (!db.objectStoreNames.contains('flashcards')) {
          const cardStore = db.createObjectStore('flashcards', { keyPath: 'id' });
          cardStore.createIndex('vocabularyId', 'vocabularyId', { unique: false });
          cardStore.createIndex('dueDate', 'dueDate', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
    });
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  // Deck operations
  async getDecks(): Promise<LanguageDeck[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('decks', 'readonly');
      const store = transaction.objectStore('decks');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async createDeck(deck: LanguageDeck): Promise<LanguageDeck> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('decks', 'readwrite');
      const store = transaction.objectStore('decks');
      const request = store.add(deck);

      request.onsuccess = () => resolve(deck);
      request.onerror = () => reject(request.error);
    });
  }

  async updateDeck(deck: LanguageDeck): Promise<LanguageDeck> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('decks', 'readwrite');
      const store = transaction.objectStore('decks');
      const request = store.put(deck);

      request.onsuccess = () => resolve(deck);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDeck(deckId: string): Promise<void> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('decks', 'readwrite');
      const store = transaction.objectStore('decks');
      const request = store.delete(deckId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Vocabulary item operations
  async getItems(deckId: string): Promise<VocabularyItem[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('items', 'readonly');
      const store = transaction.objectStore('items');
      const index = store.index('deckId');
      const request = index.getAll(deckId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addItem(item: VocabularyItem): Promise<VocabularyItem> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('items', 'readwrite');
      const store = transaction.objectStore('items');
      const request = store.add(item);

      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  async updateItem(item: VocabularyItem): Promise<VocabularyItem> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('items', 'readwrite');
      const store = transaction.objectStore('items');
      const request = store.put(item);

      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteItem(itemId: string): Promise<void> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('items', 'readwrite');
      const store = transaction.objectStore('items');
      const request = store.delete(itemId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Flashcard operations
  async getFlashcards(vocabularyId: string): Promise<Flashcard[]> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('flashcards', 'readonly');
      const store = transaction.objectStore('flashcards');
      const index = store.index('vocabularyId');
      const request = index.getAll(vocabularyId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getDueCards(deckId: string): Promise<Flashcard[]> {
    const db = this.ensureDb();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('flashcards', 'readonly');
      const store = transaction.objectStore('flashcards');
      const request = store.getAll();

      request.onsuccess = () => {
        const cards = request.result.filter(card => 
          new Date(card.dueDate) <= now
        );
        resolve(cards);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateFlashcard(card: Flashcard): Promise<Flashcard> {
    const db = this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('flashcards', 'readwrite');
      const store = transaction.objectStore('flashcards');
      const request = store.put(card);

      request.onsuccess = () => resolve(card);
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
let dbInstance: VocabularyDatabase | null = null;

export async function getVocabularyDB(): Promise<VocabularyDatabase> {
  if (!dbInstance) {
    dbInstance = new VocabularyDatabase();
    await dbInstance.init();
  }
  return dbInstance;
}
```

### 4.4 Vocabulary Hook

```typescript
// src/hooks/useVocabulary.ts

import { useState, useEffect, useCallback } from 'react';
import { getVocabularyDB } from '@/lib/vocabulary-db';
import { useLicense } from './useLicense';
import type { LanguageDeck, VocabularyItem, Flashcard } from '@/types/vocabulary';
import { FREE_TIER_LIMITS } from '@/types/vocabulary';
import { initializeNewCard } from '@/lib/srs';

interface UseVocabularyReturn {
  decks: LanguageDeck[];
  currentDeck: LanguageDeck | null;
  items: VocabularyItem[];
  isLoading: boolean;
  error: string | null;
  isAtLimit: boolean;
  setCurrentDeck: (deck: LanguageDeck | null) => void;
  createDeck: (language: string, name: string) => Promise<LanguageDeck>;
  deleteDeck: (deckId: string) => Promise<void>;
  addItem: (word: string, translation: string, context: string, source: VocabularyItem['source']) => Promise<VocabularyItem | null>;
  deleteItem: (itemId: string) => Promise<void>;
  refreshDecks: () => Promise<void>;
  refreshItems: () => Promise<void>;
}

export function useVocabulary(): UseVocabularyReturn {
  const { isPremium } = useLicense();
  const [decks, setDecks] = useState<LanguageDeck[]>([]);
  const [currentDeck, setCurrentDeck] = useState<LanguageDeck | null>(null);
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAtLimit = !isPremium && items.length >= FREE_TIER_LIMITS.maxWordsPerDeck;

  const refreshDecks = useCallback(async () => {
    try {
      const db = await getVocabularyDB();
      const allDecks = await db.getDecks();
      setDecks(allDecks);
      
      // Set current deck to first deck if not set
      if (!currentDeck && allDecks.length > 0) {
        setCurrentDeck(allDecks[0]);
      }
    } catch (err) {
      setError(String(err));
    }
  }, [currentDeck]);

  const refreshItems = useCallback(async () => {
    if (!currentDeck) {
      setItems([]);
      return;
    }
    
    try {
      const db = await getVocabularyDB();
      const deckItems = await db.getItems(currentDeck.id);
      setItems(deckItems);
    } catch (err) {
      setError(String(err));
    }
  }, [currentDeck]);

  useEffect(() => {
    refreshDecks().finally(() => setIsLoading(false));
  }, [refreshDecks]);

  useEffect(() => {
    refreshItems();
  }, [refreshItems]);

  const createDeck = useCallback(async (language: string, name: string): Promise<LanguageDeck> => {
    const db = await getVocabularyDB();
    const deck: LanguageDeck = {
      id: crypto.randomUUID(),
      language,
      name,
      createdAt: new Date(),
      stats: {
        totalWords: 0,
        wordsLearned: 0,
        dueToday: 0,
      },
    };
    
    await db.createDeck(deck);
    await refreshDecks();
    return deck;
  }, [refreshDecks]);

  const deleteDeck = useCallback(async (deckId: string): Promise<void> => {
    const db = await getVocabularyDB();
    await db.deleteDeck(deckId);
    await refreshDecks();
    
    if (currentDeck?.id === deckId) {
      setCurrentDeck(decks[0] || null);
    }
  }, [currentDeck, decks, refreshDecks]);

  const addItem = useCallback(async (
    word: string,
    translation: string,
    context: string,
    source: VocabularyItem['source']
  ): Promise<VocabularyItem | null> => {
    if (!currentDeck) {
      setError('No deck selected');
      return null;
    }

    if (isAtLimit) {
      setError(`Free tier limited to ${FREE_TIER_LIMITS.maxWordsPerDeck} words per deck. Upgrade to Premium for unlimited.`);
      return null;
    }

    const db = await getVocabularyDB();
    
    const item: VocabularyItem = {
      id: crypto.randomUUID(),
      deckId: currentDeck.id,
      word,
      language: currentDeck.language,
      translation,
      context,
      source,
      createdAt: new Date(),
      tags: [],
    };

    await db.addItem(item);

    // Create flashcards for the item
    const basicCard: Flashcard = {
      id: crypto.randomUUID(),
      vocabularyId: item.id,
      type: 'basic',
      front: word,
      back: translation,
      ...initializeNewCard(),
    };

    const reverseCard: Flashcard = {
      id: crypto.randomUUID(),
      vocabularyId: item.id,
      type: 'reverse',
      front: translation,
      back: word,
      ...initializeNewCard(),
    };

    // Add flashcards
    await db.updateFlashcard(basicCard);
    await db.updateFlashcard(reverseCard);

    await refreshItems();
    return item;
  }, [currentDeck, isAtLimit, refreshItems]);

  const deleteItem = useCallback(async (itemId: string): Promise<void> => {
    const db = await getVocabularyDB();
    await db.deleteItem(itemId);
    await refreshItems();
  }, [refreshItems]);

  return {
    decks,
    currentDeck,
    items,
    isLoading,
    error,
    isAtLimit,
    setCurrentDeck,
    createDeck,
    deleteDeck,
    addItem,
    deleteItem,
    refreshDecks,
    refreshItems,
  };
}
```

---

## 5. TTS Integration

### 5.1 TTS API Endpoint

```typescript
// src/app/api/tts/route.ts

import { NextRequest, NextResponse } from 'next/server';

const SPEACHES_BASE_URL = process.env.SPEACHES_BASE_URL || 'http://localhost:10300';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, language, voice, speed = 1.0 } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Call Speaches TTS API
    const response = await fetch(`${SPEACHES_BASE_URL}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: 'tts-1', // or specific model
        voice: voice || getDefaultVoice(language),
        speed,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.statusText}`);
    }

    // Return audio as base64
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({
      audio: base64Audio,
      format: 'mp3',
    });
  } catch (error) {
    console.error('TTS error:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio' },
      { status: 500 }
    );
  }
}

function getDefaultVoice(language: string): string {
  // Default female, motherly voices per language
  const defaultVoices: Record<string, string> = {
    'en': 'alloy',    // Calm, warm female voice
    'es': 'nova',     // Warm female voice
    'fr': 'shimmer',  // Soft female voice
    'de': 'echo',     // Warm female voice
    'it': 'fable',    // Gentle female voice
    'pt': 'alloy',
    'ja': 'nova',
    'ko': 'shimmer',
    'zh': 'alloy',
    'zh-simplified': 'alloy',
    'zh-traditional': 'alloy',
    'ar': 'nova',
  };

  return defaultVoices[language] || 'alloy';
}

export async function GET() {
  // Return available voices
  return NextResponse.json({
    voices: [
      { id: 'alloy', name: 'Alloy', description: 'Calm, warm female voice' },
      { id: 'nova', name: 'Nova', description: 'Warm, friendly female voice' },
      { id: 'shimmer', name: 'Shimmer', description: 'Soft, gentle female voice' },
      { id: 'echo', name: 'Echo', description: 'Warm female voice' },
      { id: 'fable', name: 'Fable', description: 'Gentle, storytelling voice' },
    ],
  });
}
```

### 5.2 TTS Hook

```typescript
// src/hooks/useTTS.ts

import { useState, useCallback } from 'react';

interface UseTTSReturn {
  isGenerating: boolean;
  error: string | null;
  generateAudio: (text: string, language: string, voice?: string, speed?: number) => Promise<string | null>;
  playAudio: (base64Audio: string) => void;
}

export function useTTS(): UseTTSReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAudio = useCallback(async (
    text: string,
    language: string,
    voice?: string,
    speed: number = 1.0
  ): Promise<string | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language, voice, speed }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const data = await response.json();
      return data.audio;
    } catch (err) {
      setError(String(err));
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const playAudio = useCallback((base64Audio: string) => {
    const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
    audio.play();
  }, []);

  return {
    isGenerating,
    error,
    generateAudio,
    playAudio,
  };
}
```

---

## 6. Flashcard Review Page

### 6.1 Flashcards Page

```typescript
// src/app/flashcards/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { LanguageDeckSelector } from '@/components/LanguageDeckSelector';
import { FlashcardReview } from '@/components/FlashcardReview';
import { VocabularyPanel } from '@/components/VocabularyPanel';
import { useVocabulary } from '@/hooks/useVocabulary';
import { useLicense } from '@/hooks/useLicense';
import type { LanguageDeck } from '@/types/vocabulary';

export default function FlashcardsPage() {
  const { isPremium } = useLicense();
  const { 
    decks, 
    currentDeck, 
    items, 
    isLoading, 
    error, 
    isAtLimit,
    setCurrentDeck, 
    createDeck, 
    addItem,
    deleteItem,
  } = useVocabulary();
  
  const [activeView, setActiveView] = useState<'review' | 'manage'>('review');

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_15%_-10%,#fff3c4_0%,#f7efe2_38%,#efe8da_100%)] text-[#1f1c16] dark:bg-[radial-gradient(1200px_circle_at_15%_-10%,#2a2117_0%,#13100c_45%,#0c0a08_100%)] dark:text-[#f6f1e6]">
      <AppHeader />
      
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1b1a16] dark:text-[#f4e9da]">
              Flashcards
            </h1>
            <p className="text-sm text-[#524637] dark:text-[#c8b7a0]">
              Review vocabulary with spaced repetition
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <LanguageDeckSelector
              decks={decks}
              currentDeck={currentDeck}
              onSelect={setCurrentDeck}
              onCreate={createDeck}
            />
            
            <div className="flex rounded-lg border border-[#d7c7a7] bg-white/70 p-1 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
              <button
                onClick={() => setActiveView('review')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  activeView === 'review'
                    ? 'bg-[#1f1c16] text-[#f6e9cc] dark:bg-[#f6e9cc] dark:text-[#1f1c16]'
                    : 'text-[#5c4d39] dark:text-[#d6c5ad]'
                }`}
              >
                Review
              </button>
              <button
                onClick={() => setActiveView('manage')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  activeView === 'manage'
                    ? 'bg-[#1f1c16] text-[#f6e9cc] dark:bg-[#f6e9cc] dark:text-[#1f1c16]'
                    : 'text-[#5c4d39] dark:text-[#d6c5ad]'
                }`}
              >
                Manage
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {isAtLimit && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            You've reached the free tier limit of 25 words per deck. 
            <a href="#" className="ml-1 underline">Upgrade to Premium</a> for unlimited vocabulary.
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1f1c16] border-t-transparent dark:border-[#f6e9cc]" />
          </div>
        ) : activeView === 'review' ? (
          <FlashcardReview deck={currentDeck} items={items} />
        ) : (
          <VocabularyPanel
            deck={currentDeck}
            items={items}
            isPremium={isPremium}
            isAtLimit={isAtLimit}
            onAddItem={addItem}
            onDeleteItem={deleteItem}
          />
        )}
      </main>
    </div>
  );
}
```

---

## 7. Implementation Checklist

### Phase 1A: Infrastructure (Week 1)
- [ ] Set up WASM project structure (`src-wasm/`)
- [ ] Implement Rust license validation (`src-tauri/src/license.rs`)
- [ ] Implement WASM license validation (`src-wasm/src/lib.rs`)
- [ ] Create license bridge (`src/lib/license.ts`)
- [ ] Create license hook (`src/hooks/useLicense.ts`)
- [ ] Create LicenseModal component
- [ ] Create PremiumGate component
- [ ] Add public key to Tauri and WASM

### Phase 1B: Navigation (Week 1)
- [ ] Create AppHeader component
- [ ] Create ModeTab component
- [ ] Update layout to include header
- [ ] Create `/conversation` page (placeholder)
- [ ] Create `/flashcards` page
- [ ] Create `/dashboard` page (placeholder)
- [ ] Test navigation between modes

### Phase 1C: Vocabulary System (Week 2)
- [ ] Create vocabulary types (`src/types/vocabulary.ts`)
- [ ] Implement SRS algorithm (`src/lib/srs.ts`)
- [ ] Create IndexedDB vocabulary store (`src/lib/vocabulary-db.ts`)
- [ ] Create useVocabulary hook
- [ ] Create LanguageDeckSelector component
- [ ] Create VocabularyPanel component
- [ ] Create WordCapture component (click-to-save)
- [ ] Implement free tier limits

### Phase 1D: TTS Integration (Week 2)
- [ ] Create TTS API endpoint (`/api/tts`)
- [ ] Create useTTS hook
- [ ] Integrate TTS with vocabulary items
- [ ] Add audio playback to flashcards

### Phase 1E: Flashcard Review (Week 3)
- [ ] Create FlashcardReview component
- [ ] Implement card flip animation
- [ ] Implement rating buttons (Again, Hard, Good, Easy)
- [ ] Update SRS on review
- [ ] Show session summary

### Phase 1F: Testing & Polish (Week 3)
- [ ] Test license validation (desktop + web)
- [ ] Test vocabulary CRUD operations
- [ ] Test SRS algorithm
- [ ] Test TTS generation
- [ ] Test flashcard review flow
- [ ] Add error handling
- [ ] Add loading states
- [ ] Polish UI/UX

---

## 8. Key Generation Tool

A separate admin tool for generating license keys:

```rust
// tools/keygen/src/main.rs

use ed25519_dalek::{Keypair, Signer};
use rand::rngs::OsRng;
use base32::{encode, Alphabet::RFC4648};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    
    if args.len() < 2 {
        println!("Usage: keygen <command>");
        println!("Commands:");
        println!("  generate-keys  - Generate new public/private key pair");
        println!("  create <tier>  - Create a new license key");
        return;
    }

    match args[1].as_str() {
        "generate-keys" => generate_keys(),
        "create" => create_license(args.get(2).map(|s| s.as_str())),
        _ => println!("Unknown command"),
    }
}

fn generate_keys() {
    let mut csprng = OsRng {};
    let keypair = Keypair::generate(&mut csprng);
    
    println!("Public Key (save to public_key.bin):");
    println!("{:?}", keypair.public.to_bytes());
    
    println!("\nPrivate Key (keep secret!):");
    println!("{:?}", keypair.secret.to_bytes());
}

fn create_license(tier: Option<&str>) {
    // Load private key from secure location
    // Create license payload
    // Sign and encode
    // Print license key
}
```

---

This completes the Phase 1 implementation specifications. The next phases would build upon this foundation to add AI Conversation, Adaptive Learning, and advanced features.