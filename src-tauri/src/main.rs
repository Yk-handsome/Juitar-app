#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Song {
    id: String,
    title: String,
    artist: String,
    tags: Vec<String>,
    tuning: String,
    capo: u8,
    #[serde(rename = "defaultTempo")]
    default_tempo: u16,
    score: String,
    notes: String,
    #[serde(rename = "practiceLog", skip_serializing_if = "Option::is_none")]
    practice_log: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    audio: Option<String>,
    #[serde(rename = "rootPath")]
    root_path: String,
    #[serde(rename = "scoreType")]
    score_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AppSettings {
    #[serde(rename = "vaultPath")]
    vault_path: String,
    theme: String,
    #[serde(rename = "defaultSplitRatio")]
    default_split_ratio: f32,
    #[serde(rename = "autoSave")]
    auto_save: bool,
    #[serde(rename = "autoSaveDelay")]
    auto_save_delay: u64,
    #[serde(rename = "lastSongId", skip_serializing_if = "Option::is_none")]
    last_song_id: Option<String>,
    #[serde(rename = "lastPosition", skip_serializing_if = "Option::is_none")]
    last_position: Option<u32>,
}

fn canonical(path: &str) -> Result<PathBuf, String> {
    let value = PathBuf::from(path);
    if value.as_os_str().is_empty() { return Err("路径不能为空".to_string()); }
    Ok(value)
}

#[tauri::command]
fn open_vault(path: String) -> Result<String, String> {
    let root = canonical(&path)?;
    fs::create_dir_all(root.join("Songs")).map_err(|error| format!("创建 Songs 目录失败: {error}"))?;
    fs::create_dir_all(root.join("Config")).map_err(|error| format!("创建 Config 目录失败: {error}"))?;
    Ok(root.to_string_lossy().to_string())
}

#[tauri::command]
fn scan_songs(vault_path: String) -> Result<Vec<Song>, String> {
    let root = canonical(&vault_path)?;
    let songs_dir = root.join("Songs");
    if !songs_dir.exists() { return Ok(Vec::new()); }
    let mut songs = Vec::new();
    let entries = fs::read_dir(&songs_dir).map_err(|error| format!("读取 Songs 目录失败: {error}"))?;
    for entry in entries.flatten() {
        let dir = entry.path();
        if !dir.is_dir() { continue; }
        let metadata = dir.join("song.json");
        if !metadata.exists() { continue; }
        let text = match fs::read_to_string(&metadata) { Ok(value) => value, Err(_) => continue };
        let mut song: Song = match serde_json::from_str(&text) { Ok(value) => value, Err(_) => continue };
        song.root_path = dir.to_string_lossy().to_string();
        songs.push(song);
    }
    songs.sort_by(|left, right| left.title.to_lowercase().cmp(&right.title.to_lowercase()));
    Ok(songs)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|error| format!("读取文件失败: {error}"))
}

#[tauri::command]
fn read_binary(path: String) -> Result<Vec<u8>, String> {
    fs::read(path).map_err(|error| format!("读取二进制文件失败: {error}"))
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    let target = PathBuf::from(path);
    if let Some(parent) = target.parent() { fs::create_dir_all(parent).map_err(|error| format!("创建父目录失败: {error}"))?; }
    fs::write(target, content).map_err(|error| format!("写入文件失败: {error}"))
}

#[tauri::command]
fn ensure_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|error| format!("创建目录失败: {error}"))
}

#[tauri::command]
fn create_demo_vault() -> Result<String, String> {
    let root = std::env::current_dir().map_err(|error| format!("获取工作目录失败: {error}"))?.join("sample-vault");
    let song_dir = root.join("Songs").join("Hotel California");
    fs::create_dir_all(&song_dir).map_err(|error| format!("创建示例曲目目录失败: {error}"))?;
    fs::create_dir_all(root.join("Config")).map_err(|error| format!("创建示例配置目录失败: {error}"))?;
    fs::write(song_dir.join("song.json"), include_str!("../../sample-vault/Songs/Hotel California/song.json")).map_err(|error| format!("写入示例 song.json 失败: {error}"))?;
    fs::write(song_dir.join("notes.md"), include_str!("../../sample-vault/Songs/Hotel California/notes.md")).map_err(|error| format!("写入示例 notes.md 失败: {error}"))?;
    fs::write(song_dir.join("practice-log.md"), include_str!("../../sample-vault/Songs/Hotel California/practice-log.md")).map_err(|error| format!("写入示例 practice-log.md 失败: {error}"))?;
    fs::write(song_dir.join("score.musicxml"), include_str!("../../sample-vault/Songs/Hotel California/score.musicxml")).map_err(|error| format!("写入示例谱面失败: {error}"))?;
    Ok(root.to_string_lossy().to_string())
}

#[tauri::command]
fn read_settings(vault_path: Option<String>) -> Result<AppSettings, String> {
    let Some(vault_path) = vault_path.filter(|value| !value.trim().is_empty()) else {
        return Ok(AppSettings {
            vault_path: String::new(),
            theme: "dark".to_string(),
            default_split_ratio: 56.0,
            auto_save: true,
            auto_save_delay: 800,
            last_song_id: None,
            last_position: None,
        });
    };
    let config = PathBuf::from(vault_path).join("Config").join("app.json");
    let text = fs::read_to_string(config).map_err(|error| format!("读取设置失败: {error}"))?;
    serde_json::from_str(&text).map_err(|error| format!("解析设置失败: {error}"))
}

#[tauri::command]
fn write_settings(vault_path: String, settings: AppSettings) -> Result<(), String> {
    let config_dir = PathBuf::from(vault_path).join("Config");
    fs::create_dir_all(&config_dir).map_err(|error| format!("创建配置目录失败: {error}"))?;
    let content = serde_json::to_string_pretty(&settings).map_err(|error| format!("序列化设置失败: {error}"))?;
    fs::write(config_dir.join("app.json"), content).map_err(|error| format!("写入设置失败: {error}"))
}

fn main() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![open_vault, scan_songs, read_file, read_binary, write_file, ensure_directory, create_demo_vault, read_settings, write_settings])
        .run(tauri::generate_context!());
    if let Err(error) = result { eprintln!("Juitar 启动失败: {error}"); }
}
