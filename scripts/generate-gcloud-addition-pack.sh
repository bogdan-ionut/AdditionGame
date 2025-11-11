#!/usr/bin/env bash
set -euo pipefail

VOICE="ro-RO-Chirp3-HD-Kore"
MODEL="gcloud-tts"
LANG="ro-RO"
SAMPLE_RATE=24000
RATE=1
PITCH=1
MIN_OPERAND=0
MAX_OPERAND=9

ROOT_DIR="audio/ro-RO/chirp3-hd-kore"
RAW_DIR="${ROOT_DIR}/raw"
PACK_DIR="${ROOT_DIR}/pack"
ZIP_NAME="gcloud-ro-addition-pack.zip"

usage() {
  cat <<'USAGE'
Usage: scripts/generate-gcloud-addition-pack.sh [options]

Options:
  -o, --output <path>        Base directory for generated assets (default: audio/ro-RO/chirp3-hd-kore)
  --min <number>             Lowest operand to include (default: 0)
  --max <number>             Highest operand to include (default: 9)
  --no-download              Skip the API download step and only rebuild the manifest/zip
  --token <token>            Use an explicit access token instead of invoking gcloud
  -h, --help                 Show this message

Dependencies:
  - gcloud (configured with application-default credentials)
  - jq, curl, base64, zip
  - Node.js 18+
USAGE
}

parse_args() {
  local skip_download="false"
  local explicit_token=""
  local output_dir="${ROOT_DIR}"
  local min_operand="${MIN_OPERAND}"
  local max_operand="${MAX_OPERAND}"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -o|--output)
        output_dir="$2"
        shift 2
        ;;
      --min)
        min_operand="$2"
        shift 2
        ;;
      --max)
        max_operand="$2"
        shift 2
        ;;
      --no-download)
        skip_download="true"
        shift 1
        ;;
      --token)
        explicit_token="$2"
        shift 2
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1" >&2
        usage >&2
        exit 1
        ;;
    esac
  done

  ROOT_DIR="$(cd "$(dirname "$output_dir")" && pwd)/$(basename "$output_dir")"
  RAW_DIR="${ROOT_DIR}/raw"
  PACK_DIR="${ROOT_DIR}/pack"

  MIN_OPERAND="$min_operand"
  MAX_OPERAND="$max_operand"
  SKIP_DOWNLOAD="$skip_download"
  ACCESS_TOKEN_OVERRIDE="$explicit_token"
}

ensure_dependencies() {
  for tool in curl jq base64 zip; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      echo "Missing dependency: $tool" >&2
      exit 1
    fi
  done
  if ! command -v node >/dev/null 2>&1; then
    echo "Missing dependency: node" >&2
    exit 1
  fi
}

fetch_token() {
  if [[ -n "${ACCESS_TOKEN_OVERRIDE:-}" ]]; then
    echo "$ACCESS_TOKEN_OVERRIDE"
    return
  fi
  if ! command -v gcloud >/dev/null 2>&1; then
    echo "gcloud CLI is required to obtain an access token." >&2
    exit 1
  fi
  gcloud auth application-default print-access-token
}

synthesize_batch() {
  mkdir -p "$RAW_DIR"
  local token="$1"
  for ((i=MIN_OPERAND; i<=MAX_OPERAND; i++)); do
    for ((j=MIN_OPERAND; j<=MAX_OPERAND; j++)); do
      local text="Cât face ${i} plus ${j}?"
      local filename="cat-face-${i}-plus-${j}.mp3"
      local output_file="${RAW_DIR}/${filename}"
      if [[ -f "$output_file" ]]; then
        echo "⤴  Skipping ${filename} (already exists)"
        continue
      fi
      echo "→  Generating ${filename}"
      local curl_args=(
        -s
        -X POST
        -H "Authorization: Bearer ${token}"
        -H "Content-Type: application/json; charset=utf-8"
      )
      if [[ -n "${GCLOUD_PROJECT:-}" ]]; then
        curl_args+=( -H "x-goog-user-project: ${GCLOUD_PROJECT}" )
      fi
      curl "${curl_args[@]}" \
        -d "$(jq -n --arg t "$text" --arg v "$VOICE" --argjson rate "$RATE" --argjson pitch "$PITCH" --argjson sample "$SAMPLE_RATE" ' {
              input: { text: $t },
              voice: { languageCode: "ro-RO", name: $v },
              audioConfig: {
                audioEncoding: "MP3",
                sampleRateHertz: $sample,
                speakingRate: $rate,
                pitch: $pitch
              }
            }')" \
        "https://texttospeech.googleapis.com/v1/text:synthesize" \
        | jq -r '.audioContent' | base64 --decode >"${output_file}"
      if [[ ! -s "$output_file" ]]; then
        echo "✖  Failed to create ${filename}" >&2
        rm -f "$output_file"
        exit 1
      fi
      echo "✔  Saved ${filename}"
    done
  done
}

build_manifest() {
  mkdir -p "$PACK_DIR"
  node "$(dirname "$0")/build-gcloud-addition-pack.mjs" \
    --input "$RAW_DIR" \
    --output "$PACK_DIR" \
    --voice "$VOICE" \
    --lang "$LANG" \
    --model "$MODEL" \
    --sample-rate "$SAMPLE_RATE" \
    --rate "$RATE" \
    --pitch "$PITCH" \
    --min "$MIN_OPERAND" \
    --max "$MAX_OPERAND" \
    --zip-name "$ZIP_NAME"
}

main() {
  parse_args "$@"
  ensure_dependencies

  if [[ "${SKIP_DOWNLOAD}" != "true" ]]; then
    local token
    token="$(fetch_token)"
    synthesize_batch "$token"
  else
    mkdir -p "$RAW_DIR"
  fi

  build_manifest
}

main "$@"
