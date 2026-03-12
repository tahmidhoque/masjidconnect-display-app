#!/usr/bin/env node
/**
 * WiFi setup server for MasjidConnect Display — runs before the kiosk when no
 * internet is detected. Serves a GUI to scan and connect to WiFi.
 *
 * Two modes of operation:
 *   1. Local mode (default): Binds to 127.0.0.1:3002, shown on the Pi display.
 *   2. AP mode (--ap-mode): Binds to 0.0.0.0:80, accessible from phones
 *      connected to the MasjidConnect-Setup hotspot. Also serves a branded
 *      instructions page at /instructions for the Pi's own display, and
 *      handles captive-portal probe URLs so phones auto-open the setup page.
 *
 * Must run as root (or with CAP_NET_ADMIN etc.) to run iw and write
 * /etc/wpa_supplicant. Typically started via sudo from xinitrc-kiosk.
 *
 * Usage:
 *   sudo /opt/masjidconnect/deploy/wifi-setup-server.mjs                          # local mode
 *   sudo /opt/masjidconnect/deploy/wifi-setup-server.mjs --ap-mode --iface=wlan0  # AP/hotspot mode
 *
 * Arguments (preferred over env vars — sudo strips arbitrary env vars):
 *   --ap-mode        Enable AP/hotspot mode (port 80, 0.0.0.0)
 *   --iface=<name>   Wireless interface name (default: wlan0)
 */

import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { pbkdf2Sync } from 'node:crypto';

// Parse CLI args — preferred over env vars because sudo strips arbitrary env vars.
// Fall back to env vars for backwards compatibility with any direct invocations.
const _args = process.argv.slice(2);
// Inline SVG logo (logo-notext-white.svg) — embedded so pages work fully offline on the hotspot.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="112.43 92.492 150.128 150.121" style="width:100%;height:100%">
  <defs>
    <clipPath id="mc-a"><path d="M169 212h37v30.492h-37Zm0 0"/></clipPath>
    <clipPath id="mc-b"><path d="M112.43 149H144v38h-31.57Zm0 0"/></clipPath>
    <clipPath id="mc-c"><path d="M169 92.492h37V124h-37Zm0 0"/></clipPath>
    <clipPath id="mc-d"><path d="M231 149h31.43v38H231Zm0 0"/></clipPath>
  </defs>
  <path fill="#fff" d="m166.402 116.648-.703 1.743a54.6 54.6 0 0 0-3.77 15.898l-.152 1.844 1.848.148c3.602.29 7.113.883 10.43 1.75l1.351.36.711-1.211a60.3 60.3 0 0 1 6.137-8.614l1.2-1.41-1.415-1.191a54.5 54.5 0 0 0-13.906-8.578Zm11.84 10.977a64 64 0 0 0-4.597 6.5 64 64 0 0 0-7.852-1.348 50.8 50.8 0 0 1 2.648-11.214 51 51 0 0 1 9.801 6.062m0 0"/>
  <g clip-path="url(#mc-a)"><path fill="#fff" d="m187.496 242.613 1.008-.66a54.4 54.4 0 0 0 8.781-7.133c2.797-2.789 5.32-5.957 7.508-9.406l1.152-1.812-1.968-.868a60.5 60.5 0 0 1-15.274-9.644l-1.207-1.047-1.207 1.047a60.4 60.4 0 0 1-15.273 9.648l-1.965.867 1.148 1.81a54.3 54.3 0 0 0 7.5 9.405 54.3 54.3 0 0 0 8.79 7.133Zm-13.012-17.406a64.6 64.6 0 0 0 13.008-8.309 64.4 64.4 0 0 0 13.016 8.305 51 51 0 0 1-5.832 7.012 51.4 51.4 0 0 1-7.18 5.972 50.5 50.5 0 0 1-7.191-5.972 50.4 50.4 0 0 1-5.82-7.008m0 0"/></g>
  <path fill="#fff" d="m208.574 218.473.703-1.743a54.6 54.6 0 0 0 3.766-15.894l.156-1.848-1.844-.148c-1.87-.149-3.39-.324-4.87-.567q-1.243-.21-2.407-.445a56 56 0 0 1-2.215-.504l-2.289-.59-.707 1.207c-1.726 2.957-3.793 5.856-6.137 8.61l-1.199 1.41 1.414 1.195a54.8 54.8 0 0 0 13.895 8.574Zm-11.832-10.98a64 64 0 0 0 4.598-6.497c.633.152 1.293.3 2.039.453.785.16 1.621.317 2.601.485a59 59 0 0 0 3.204.414 51.3 51.3 0 0 1-2.645 11.207 51.3 51.3 0 0 1-9.797-6.063m0 0"/>
  <g clip-path="url(#mc-b)"><path fill="#fff" d="m131.477 186.027.855-1.972c1.434-3.278 3.086-6.336 4.902-9.078l1.028-1.504c.105-.149.222-.305.343-.465l.829-1.133c.32-.426.62-.809.933-1.2.242-.312.551-.687 1.051-1.288l1.586-1.82-1.05-1.215a56 56 0 0 1-2.731-3.395 53 53 0 0 1-1.97-2.785c-1.831-2.766-3.483-5.824-4.921-9.102l-.855-1.968-1.817 1.144a54.5 54.5 0 0 0-9.437 7.516 54.4 54.4 0 0 0-7.133 8.793l-.66 1.007.66 1.008a54.5 54.5 0 0 0 7.137 8.797c2.793 2.797 5.968 5.324 9.43 7.512Zm-14.622-18.465a51 51 0 0 1 5.98-7.19 50 50 0 0 1 7.028-5.837 63 63 0 0 0 4.32 7.68 59 59 0 0 0 2.172 3.07c.57.762 1.168 1.524 1.786 2.274a25 25 0 0 0-.664.828c-.372.457-.754.953-1.18 1.523l-.64.883c-.165.215-.329.437-.52.71l-.965 1.415a62 62 0 0 0-4.313 7.672 50.4 50.4 0 0 1-13.004-13.028m0 0"/></g>
  <path fill="#fff" d="m166.402 218.477 1.735-.739a54.8 54.8 0 0 0 13.898-8.582l1.418-1.191-1.2-1.41c-2.339-2.754-4.405-5.653-6.136-8.618l-.707-1.207-1.355.356a60.3 60.3 0 0 1-10.434 1.75l-1.844.152.153 1.844a54.9 54.9 0 0 0 3.77 15.906Zm7.243-17.485a64 64 0 0 0 4.597 6.5 51 51 0 0 1-9.8 6.067 51 51 0 0 1-2.649-11.223c2.687-.29 5.32-.742 7.852-1.344m-39.239 19.641 1.18.242c3.61.766 7.36 1.152 11.148 1.152 4.067 0 8.13-.445 12.082-1.328l2.098-.469-.781-2a60.6 60.6 0 0 1-3.985-17.628l-.117-1.59-1.594-.117a60.8 60.8 0 0 1-17.636-3.98l-2-.782-.469 2.094a54.5 54.5 0 0 0-1.336 11.972c0 3.79.39 7.574 1.164 11.246Zm3.106-21.524a64.4 64.4 0 0 0 15.09 3.332 64.2 64.2 0 0 0 3.328 15.079c-6.094 1.097-12.41 1.093-18.395-.016a51 51 0 0 1-.847-9.305 50.5 50.5 0 0 1 .824-9.09m-.934-10.457 1.746.703a55 55 0 0 0 15.89 3.762l1.849.153.148-1.844c.289-3.598.879-7.11 1.75-10.43l.355-1.355-1.21-.707c-2.958-1.727-5.852-3.79-8.665-6.18l-1.418-1.059-1.484 1.735c-.254.3-.473.57-.746.918a13 13 0 0 0-.45.582l-.488.625c-.257.347-.507.683-.87 1.203l-1.048 1.492.012.008a53 53 0 0 0-4.637 8.664Zm8.457-8.379 1.977-2.773c.113-.133.222-.27.328-.422.066-.094.14-.187.21-.273a63 63 0 0 0 6.505 4.601 63 63 0 0 0-1.348 7.848 51.6 51.6 0 0 1-11.223-2.645 50 50 0 0 1 3.551-6.336m13.281-24.804-.355-1.356a60 60 0 0 1-1.75-10.418l-.149-1.847-1.847.156c-5.512.465-10.863 1.73-15.895 3.766l-1.734.703.726 1.726a54.5 54.5 0 0 0 4.743 8.82 55 55 0 0 0 1.797 2.54c.097.129.199.254.324.406l.14.172a54 54 0 0 0 1.586 1.96l1.196 1.415 1.41-1.203c2.746-2.336 5.637-4.403 8.601-6.137Zm-10.754 2.836a17 17 0 0 1-.324-.418l-.433-.535a57 57 0 0 1-1.707-2.415 50 50 0 0 1-3.606-6.425 51 51 0 0 1 11.215-2.645 64 64 0 0 0 1.348 7.84 65 65 0 0 0-6.493 4.598m-14.566-31.375c0 4.015.45 8.043 1.336 11.968l.473 2.094 1.996-.781a60.4 60.4 0 0 1 17.637-3.996l1.593-.117.117-1.59a60.4 60.4 0 0 1 3.985-17.621l.781-1.996-2.094-.473c-7.648-1.719-15.68-1.777-23.226-.184l-1.18.25-.246 1.176a54.6 54.6 0 0 0-1.172 11.27m4.547-9.317c5.988-1.11 12.309-1.11 18.39-.011a64 64 0 0 0-3.331 15.066 64 64 0 0 0-15.09 3.344 50.8 50.8 0 0 1 .031-18.399m0 0"/>
  <path fill="#fff" d="m210.402 177.64.075-.261c.05-.164.113-.316.195-.48.05-.098.098-.196.16-.29l.184-.23a2.5 2.5 0 0 1 .254-.27l.164-.152c.09-.074.207-.137.332-.21l.16-.114a54 54 0 0 0 10.215-6.649l1.722-1.422-1.722-1.421a53.5 53.5 0 0 0-10.09-6.59l-.219-.133a2.7 2.7 0 0 1-.414-.273l-.16-.145a2.5 2.5 0 0 1-.274-.305l-.101-.113-.04-.05a4 4 0 0 1-.238-.434c-.042-.09-.07-.184-.097-.266-.043-.133-.082-.246-.106-.371-.023-.094-.027-.184-.039-.281a3 3 0 0 1-.008-.332c0-.086-.003-.168.012-.286l.047-.222a1.7 1.7 0 0 0 .055-.317c.207-.636.402-1.277.656-2.093a55 55 0 0 0 1.723-8.547c.043-.313.066-.617.113-1.078l.226-2.461-2.222.21a54 54 0 0 0-11.918 2.524 2.875 2.875 0 0 1-3.465-1.437 54.6 54.6 0 0 0-6.668-10.227l-1.422-1.73-1.426 1.726a54.6 54.6 0 0 0-6.66 10.23 2.87 2.87 0 0 1-3.469 1.438 54.4 54.4 0 0 0-11.945-2.523l-2.23-.215.215 2.226a54 54 0 0 0 2.523 11.93 2.884 2.884 0 0 1-1.434 3.473 54.6 54.6 0 0 0-10.234 6.676l-1.715 1.425 1.723 1.418a54 54 0 0 0 10.219 6.653 2.88 2.88 0 0 1 1.441 3.472 54.6 54.6 0 0 0-2.523 11.946l-.215 2.226 2.23-.215a54.4 54.4 0 0 0 11.95-2.523c1.304-.442 2.84.183 3.464 1.437a54.3 54.3 0 0 0 6.66 10.227l1.422 1.726 1.426-1.726a54.3 54.3 0 0 0 6.668-10.23 2.88 2.88 0 0 1 3.48-1.43 52 52 0 0 0 4.168 1.21 59 59 0 0 0 4.282.872c1.12.183 2.281.332 3.457.441l2.215.215-.235-2.57c-.031-.336-.058-.668-.101-.98a55 55 0 0 0-1.778-8.72c-.195-.64-.394-1.28-.601-1.949l-.051-.28-.055-.227c-.011-.118-.011-.231-.011-.344 0-.082 0-.16.011-.266.008-.11.02-.21.04-.312m-.121-5.308a3.4 3.4 0 0 0-.418.25 6 6 0 0 0-.707.48 5 5 0 0 0-.488.434 7 7 0 0 0-.473.504q-.171.168-.308.355c-.078.11-.145.227-.137.227a8 8 0 0 0-.375.664 7 7 0 0 0-.461 1.18 6 6 0 0 0-.129.476 7 7 0 0 0-.125 1.32c0 .239.008.497.04.759.019.171.054.343.097.515l.035.207c.027.156.062.344.129.543.203.621.394 1.238.625 1.985a52 52 0 0 1 1.46 6.906c-.312-.047-.624-.09-.929-.14a54 54 0 0 1-3.996-.821 46 46 0 0 1-3.875-1.117c-3.078-1.051-6.5.355-7.96 3.273a50.7 50.7 0 0 1-4.794 7.727 51 51 0 0 1-4.785-7.727 6.52 6.52 0 0 0-5.863-3.621c-.7 0-1.399.113-2.07.336a50.4 50.4 0 0 1-8.848 2.082 51 51 0 0 1 2.082-8.852c1.023-3.07-.395-6.484-3.293-7.933a50.7 50.7 0 0 1-7.719-4.778 51 51 0 0 1 7.73-4.796c2.895-1.457 4.305-4.868 3.278-7.938A50 50 0 0 1 165.93 146a50.4 50.4 0 0 1 8.847 2.078c3.067 1.016 6.485-.39 7.938-3.289a50.7 50.7 0 0 1 4.785-7.723 50.6 50.6 0 0 1 4.79 7.727c1.452 2.898 4.862 4.309 7.937 3.281a50.4 50.4 0 0 1 8.832-2.078 52 52 0 0 1-1.508 7.024c-.192.62-.383 1.238-.582 1.859a5.4 5.4 0 0 0-.164.746 4 4 0 0 0-.094.508c-.035.265-.04.504-.04.73a7 7 0 0 0 .117 1.32c.06.29.146.567.232.829q.104.316.238.62c.148.325.316.634.465.84l.172.286c.09.125.19.238.218.254a7 7 0 0 0 .996 1.004 5.7 5.7 0 0 0 .875.586l.297.18a50 50 0 0 1 7.711 4.777 50.4 50.4 0 0 1-7.71 4.773m-1.535 2.629"/>
  <path fill="#fff" d="m208.582 116.648-1.73.735a54.5 54.5 0 0 0-13.903 8.574l-1.414 1.195 1.2 1.414a60.5 60.5 0 0 1 6.136 8.61l.711 1.21 1.352-.355a60 60 0 0 1 10.421-1.75l1.844-.152-.152-1.844a54.8 54.8 0 0 0-3.758-15.894Zm-7.238 17.477a64 64 0 0 0-4.602-6.504 51 51 0 0 1 9.801-6.058 51 51 0 0 1 2.64 11.214c-2.68.293-5.308.746-7.84 1.348m0 0"/>
  <g clip-path="url(#mc-c)"><path fill="#fff" d="m187.492 92.492-1.004.66a54.7 54.7 0 0 0-8.789 7.149 55 55 0 0 0-7.5 9.41l-1.152 1.812 1.969.864a60.4 60.4 0 0 1 15.27 9.64l1.206 1.047 1.207-1.047a60.2 60.2 0 0 1 15.278-9.64l1.964-.864-1.144-1.812a54.6 54.6 0 0 0-7.5-9.414 55 55 0 0 0-8.793-7.14Zm13.02 17.422a64 64 0 0 0-13.02 8.3 64 64 0 0 0-13.008-8.296 50.7 50.7 0 0 1 5.832-7.008 51 51 0 0 1 7.18-5.992 52 52 0 0 1 7.195 5.984 50.4 50.4 0 0 1 5.82 7.012m0 0"/></g>
  <path fill="#fff" d="M228.25 222.027c3.773 0 7.523-.386 11.145-1.144l1.183-.242.246-1.184a55 55 0 0 0 1.156-11.258c0-4.004-.445-8.027-1.328-11.969l-.472-2.093-2 .781c-1.118.437-2.118.8-3.055 1.11l-.336.105a41 41 0 0 1-1.184.37l-.23.067c-3.844 1.145-7.86 1.907-12.125 2.278l-2.305.16-.117 1.601a60.6 60.6 0 0 1-3.984 17.621l-.781 2.004 2.097.47a55.7 55.7 0 0 0 12.09 1.323m-5.879-19.511 1.082-.075v-.105a64 64 0 0 0 10.918-2.211l.285-.082a56 56 0 0 0 1.262-.398l1.562-.5a51 51 0 0 1 .813 9.054c0 3.145-.285 6.27-.84 9.305-6.004 1.105-12.324 1.105-18.406.012a64.5 64.5 0 0 0 3.324-15m4.109-29.716a60 60 0 0 1-8.605 6.134l-1.207.707.352 1.351a61 61 0 0 1 1.53 8.078c.09.73.165 1.473.22 2.2l.136 1.984 2.043-.14a55 55 0 0 0 12.344-2.528 54 54 0 0 0 3.375-1.23l1.742-.704-.738-1.73a54.5 54.5 0 0 0-8.582-13.906l-1.195-1.414Zm7.012 13.817a42 42 0 0 1-1.344.465 52 52 0 0 1-1.437.445 51 51 0 0 1-8.422 1.739c-.027-.215-.05-.434-.078-.653l-.008-.062a65 65 0 0 0-1.277-7.14 63 63 0 0 0 6.496-4.599 51 51 0 0 1 6.07 9.805m4.918-40.14-1.742-.704a54.6 54.6 0 0 0-15.887-3.77l-1.844-.155-.148 1.84a69 69 0 0 1-.242 2.414 61 61 0 0 1-1.527 8.023l-.348 1.352 1.207.707a60 60 0 0 1 8.605 6.14l1.41 1.2 1.196-1.415c3.566-4.222 6.457-8.898 8.582-13.902Zm-10.984 11.832a64 64 0 0 0-6.5-4.602 64 64 0 0 0 1.281-7.168q.042-.333.078-.672a50.7 50.7 0 0 1 11.207 2.64 51 51 0 0 1-6.066 9.802m13.226-19.419a54.8 54.8 0 0 0 .16-23.238l-.25-1.175-1.175-.247c-7.555-1.59-15.582-1.523-23.223.192l-2.094.473.778 2a60.4 60.4 0 0 1 3.98 17.62l.117 1.594 1.59.114a60.4 60.4 0 0 1 17.645 3.988l2 .777Zm-3.183-2.878a64.3 64.3 0 0 0-15.094-3.34 64 64 0 0 0-3.328-15.07c6.086-1.098 12.402-1.098 18.394.003a50.9 50.9 0 0 1 .028 18.407m0 0"/>
  <g clip-path="url(#mc-d)"><path fill="#fff" d="m243.531 186.016 1.82-1.153a55.4 55.4 0 0 0 9.399-7.496 54.3 54.3 0 0 0 7.148-8.797l.66-1.011-.66-1.008a54.4 54.4 0 0 0-7.14-8.781c-2.785-2.79-5.953-5.313-9.41-7.504l-1.817-1.153-.86 1.969a60.6 60.6 0 0 1-9.648 15.27l-1.046 1.207 1.046 1.21a60.6 60.6 0 0 1 9.653 15.274Zm1.606-31.465a51 51 0 0 1 7.015 5.832 51 51 0 0 1 5.98 7.176 50.4 50.4 0 0 1-5.984 7.191 51 51 0 0 1-7.007 5.824 64.3 64.3 0 0 0-8.313-13.015 64.2 64.2 0 0 0 8.309-13.008m0 0"/></g>
</svg>`;

const AP_MODE = _args.includes('--ap-mode') || process.env.WIFI_AP_MODE === '1' || process.env.WIFI_AP_MODE === 'true';
const IFACE = (_args.find(a => a.startsWith('--iface=')) || '').replace('--iface=', '')
  || process.env.WIFI_HOTSPOT_IFACE
  || 'wlan0';

const PORT = AP_MODE ? 80 : parseInt(process.env.WIFI_SETUP_PORT || '3002', 10);
const HOST = AP_MODE ? '0.0.0.0' : '127.0.0.1';
const FLAG_FILE = '/tmp/masjidconnect-wifi-done';
const WIFI_CONNECTED_MARKER = '/var/lib/masjidconnect/wifi-connected-once';
const WPA_CONF = `/etc/wpa_supplicant/wpa_supplicant-${IFACE}.conf`;
const SCAN_CACHE = '/tmp/masjidconnect-wifi-scan.json';
const HOTSPOT_SCRIPT = '/opt/masjidconnect/deploy/wifi-hotspot.sh';
const CONNECT_STATUS_FILE = '/tmp/masjidconnect-wifi-connect-status.json';
const WIFI_HOTSPOT_ACTIVE_MARKER = '/tmp/masjidconnect-hotspot-active';

/** Dev mode: no root, no real WiFi — mock scan/connect for local UI testing */
const DEV = process.env.WIFI_SETUP_DEV === '1' || process.env.WIFI_SETUP_DEV === 'true';

/** Track whether a connection attempt is in progress (AP mode) */
let connectingInProgress = false;
let lastConnectError = '';

function send(res, status, body, contentType = 'application/json') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache, no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Ensure system binaries are reachable regardless of sudo PATH stripping.
const SYSTEM_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      env: { ...process.env, PATH: SYSTEM_PATH },
      ...opts,
    });
  } catch (e) {
    if (opts.allowFail) return '';
    throw e;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** GET /api/scan — list SSIDs. In AP mode, reads from the pre-scan cache. */
function handleScan() {
  if (DEV) {
    return { ssids: ['TestNetwork1', 'TestNetwork2', 'MyWiFi-5G', 'HiddenNetworkTest'], _dev: true };
  }

  // In AP mode, wlan0 is running hostapd so live scan is impossible — use cached results
  if (AP_MODE && existsSync(SCAN_CACHE)) {
    try {
      const cached = JSON.parse(readFileSync(SCAN_CACHE, 'utf8'));
      return { ssids: cached.ssids || [], cached: true };
    } catch { /* fall through to live scan */ }
  }

  try {
    const out = run(`iw dev ${IFACE} scan 2>/dev/null`, { allowFail: true });
    const ssids = new Set();
    for (const line of out.split('\n')) {
      const m = line.match(/^\s*SSID:\s*(.+)$/);
      if (m) {
        const ssid = m[1].trim();
        if (ssid) ssids.add(ssid);
      }
    }
    return { ssids: [...ssids].sort() };
  } catch {
    return { ssids: [], error: 'Could not scan (is wlan0 present?)' };
  }
}

/**
 * Derive WPA-PSK (PMK) from passphrase and SSID (same as wpa_passphrase).
 * Uses PBKDF2-HMAC-SHA1, 4096 iterations, 32-byte key.
 */
function derivePskHex(passphrase, ssid) {
  const key = pbkdf2Sync(passphrase, ssid, 4096, 32, 'sha1');
  return key.toString('hex');
}

/**
 * Write wpa_supplicant configuration file.
 * Shared between local and AP mode connect handlers.
 */
function writeWpaConfig(ssidTrimmed, pass, countryCode) {
  const header = `ctrl_interface=/run/wpa_supplicant\nupdate_config=1\ncountry=${countryCode}\n\n`;
  let networkBlock = `network={\n\tssid="${ssidTrimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"\n`;
  if (pass.length > 0) {
    const pskHex = derivePskHex(pass, ssidTrimmed);
    networkBlock += `\tpsk=${pskHex}\n`;
  } else {
    networkBlock += '\tkey_mgmt=NONE\n';
  }
  networkBlock += '}\n';
  mkdirSync('/etc/wpa_supplicant', { recursive: true });
  writeFileSync(WPA_CONF, header + networkBlock, { mode: 0o600 });
}

/**
 * Check internet connectivity (curl portal or ping 8.8.8.8).
 * Uses run() so that PATH is set correctly under sudo.
 */
function checkConnectivity() {
  try {
    run('curl -sf --connect-timeout 3 -o /dev/null https://portal.masjidconnect.co.uk 2>/dev/null');
    return true;
  } catch {
    try {
      run('ping -c 1 -W 2 8.8.8.8 2>/dev/null');
      return true;
    } catch {
      return false;
    }
  }
}

/** POST /api/connect — write wpa_supplicant config and connect */
function handleConnect(body) {
  const { ssid, password = '', country = 'GB' } = body;
  if (!ssid || typeof ssid !== 'string' || !ssid.trim()) {
    return { ok: false, error: 'Please select or enter a network name' };
  }
  if (DEV) {
    return { ok: true, _dev: true };
  }
  const pass = typeof password === 'string' ? password : String(password || '').trim();
  const ssidTrimmed = ssid.trim();
  const countryCode = String(country || 'GB').toUpperCase().slice(0, 2);

  try {
    writeWpaConfig(ssidTrimmed, pass, countryCode);

    if (!AP_MODE) {
      ensureNetworkdDhcp();
      enableWifiOnBoot();
      run(`systemctl restart wpa_supplicant@${IFACE}.service`);
      return { ok: true };
    }

    // AP mode: respond immediately, then tear down AP and connect asynchronously
    connectingInProgress = true;
    lastConnectError = '';

    // Fire-and-forget: stop AP, start wpa_supplicant, poll for connectivity
    setTimeout(() => apModeConnectAsync(), 2000);

    return { ok: true, apMode: true, message: 'Connecting… The hotspot will disappear shortly. Please reconnect to your normal Wi-Fi.' };
  } catch (e) {
    return { ok: false, error: (e.message || String(e)).slice(0, 200) };
  }
}

/**
 * Ensure a systemd-networkd .network file exists for the wireless interface
 * so that DHCP runs automatically after wpa_supplicant authenticates.
 */
function ensureNetworkdDhcp() {
  const netFile = `/etc/systemd/network/25-${IFACE}.network`;
  const content = [
    '[Match]',
    `Name=${IFACE}`,
    '',
    '[Network]',
    'DHCP=yes',
    '',
  ].join('\n');
  try {
    mkdirSync('/etc/systemd/network', { recursive: true });
    writeFileSync(netFile, content, { mode: 0o644 });
    process.stderr.write(`[wifi-setup] Wrote ${netFile}\n`);
  } catch (e) {
    process.stderr.write(`[wifi-setup] Could not write ${netFile}: ${e.message}\n`);
  }
}

/**
 * Enable wpa_supplicant and networkd so Wi-Fi auto-connects on next boot.
 */
function enableWifiOnBoot() {
  run(`systemctl enable wpa_supplicant@${IFACE}.service`, { allowFail: true });
  run('systemctl enable systemd-networkd.service', { allowFail: true });
  process.stderr.write(`[wifi-setup] Enabled wpa_supplicant@${IFACE} and systemd-networkd for next boot\n`);
}

/**
 * AP mode: asynchronous connect sequence.
 * Tears down the hotspot, starts wpa_supplicant + DHCP, polls for connectivity.
 * On failure, restarts the AP so the user can retry.
 */
async function apModeConnectAsync() {
  try {
    process.stderr.write('[wifi-setup] AP mode: stopping hotspot, starting wpa_supplicant...\n');

    // 1. Stop the hotspot and restore the interface to managed mode
    run(`${HOTSPOT_SCRIPT} stop ${IFACE}`, { allowFail: true });
    await sleep(1000);

    // 2. Ensure DHCP is configured for this interface (systemd-networkd)
    ensureNetworkdDhcp();

    // 3. Restart systemd-networkd so it picks up the new .network file
    run('systemctl restart systemd-networkd.service', { allowFail: true });
    await sleep(500);

    // 4. Start wpa_supplicant to authenticate with the configured network
    run(`systemctl restart wpa_supplicant@${IFACE}.service`, { allowFail: true });

    // 5. Also try dhcpcd/dhclient as fallback DHCP clients (one of these
    //    usually exists on RPi OS; they're harmless if systemd-networkd
    //    is already handling DHCP).
    await sleep(2000);
    run(`dhcpcd ${IFACE} 2>/dev/null`, { allowFail: true });
    run(`dhclient ${IFACE} 2>/dev/null`, { allowFail: true });

    // 6. Poll for connectivity — allow up to 45 seconds for WPA auth + DHCP
    process.stderr.write('[wifi-setup] Waiting for connectivity...\n');
    let connected = false;
    for (let i = 0; i < 45; i++) {
      await sleep(1000);
      if (checkConnectivity()) {
        connected = true;
        process.stderr.write(`[wifi-setup] Connected after ${i + 1}s\n`);
        break;
      }
    }

    if (connected) {
      process.stderr.write('[wifi-setup] AP mode: connected to Wi-Fi!\n');
      connectingInProgress = false;
      lastConnectError = '';

      // Persist: enable services so Wi-Fi reconnects automatically on next boot
      enableWifiOnBoot();

      // Mark that we've had successful connectivity (for xinitrc state machine)
      try {
        mkdirSync('/var/lib/masjidconnect', { recursive: true });
        writeFileSync(WIFI_CONNECTED_MARKER, '1');
      } catch { /* non-fatal */ }

      try {
        unlinkSync(WIFI_HOTSPOT_ACTIVE_MARKER);
      } catch { /* non-fatal */ }
      writeFileSync(FLAG_FILE, '1');
      writeFileSync(CONNECT_STATUS_FILE, JSON.stringify({ connected: true }));
    } else {
      process.stderr.write('[wifi-setup] AP mode: connection failed, restarting AP...\n');
      connectingInProgress = false;
      lastConnectError = 'Could not connect to the selected network. Please check the password and try again.';
      writeFileSync(CONNECT_STATUS_FILE, JSON.stringify({ connected: false, error: lastConnectError }));

      // Restart the AP so the user can retry
      run(`${HOTSPOT_SCRIPT} scan ${IFACE}`, { allowFail: true });
      await sleep(500);
      run(`${HOTSPOT_SCRIPT} start ${IFACE}`, { allowFail: true });
    }
  } catch (e) {
    connectingInProgress = false;
    lastConnectError = 'An error occurred: ' + (e.message || String(e)).slice(0, 200);
    process.stderr.write(`[wifi-setup] AP mode connect error: ${lastConnectError}\n`);

    try {
      run(`${HOTSPOT_SCRIPT} start ${IFACE}`, { allowFail: true });
    } catch { /* best effort */ }
  }
}

/** GET /api/status — connectivity check + AP mode metadata */
function handleStatus() {
  if (DEV) {
    return { connected: true, apMode: AP_MODE, _dev: true };
  }

  const connected = checkConnectivity();
  const result = {
    connected,
    apMode: AP_MODE,
  };

  if (AP_MODE) {
    result.connecting = connectingInProgress;
    if (lastConnectError) {
      result.retryError = lastConnectError;
    }
  }

  return result;
}

/** POST /api/start-display — set flag so xinitrc continues to kiosk */
function handleStartDisplay() {
  if (DEV) return { ok: true, _dev: true };
  try {
    writeFileSync(FLAG_FILE, '1');
    if (checkConnectivity()) {
      try {
        mkdirSync('/var/lib/masjidconnect', { recursive: true });
        writeFileSync(WIFI_CONNECTED_MARKER, '1');
      } catch { /* non-fatal */ }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}


// =============================================================================
// HTML — Phone-facing Wi-Fi setup page (served at /)
// =============================================================================

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MasjidConnect — Wi-Fi Setup</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #0f1729 0%, #1a2744 50%, #0d2137 100%);
      color: #e8ecf1; padding: 1rem;
    }
    .card {
      background: rgba(22, 33, 62, 0.95); border-radius: 16px; padding: 2rem;
      max-width: 440px; width: 100%;
      box-shadow: 0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05);
    }
    .brand { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.5rem; }
    .brand-logo { width: 40px; height: 40px; flex-shrink: 0; }
    .brand-text {
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 1.1rem; font-weight: 400; color: #fff; letter-spacing: -0.01em;
    }
    .brand-text strong { font-weight: 700; }
    h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 0.4rem; color: #fff; }
    .subtitle { color: #8892a4; font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.4; }
    .form-group { margin-bottom: 1rem; }
    label { display: block; margin-bottom: 0.4rem; font-size: 0.85rem; font-weight: 600; color: #a0aec0; text-transform: uppercase; letter-spacing: 0.5px; }
    select, input[type="password"], input[type="text"] {
      width: 100%; padding: 0.7rem 0.85rem; border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.1); background: rgba(15, 15, 30, 0.6);
      color: #e8ecf1; font-size: 1rem; transition: border-color 0.2s;
    }
    select:focus, input:focus { outline: none; border-color: #4361ee; }
    .manual-toggle { font-size: 0.8rem; color: #4361ee; cursor: pointer; margin-top: 0.3rem; display: inline-block; }
    .manual-toggle:hover { text-decoration: underline; }
    .manual-input { display: none; margin-top: 0.5rem; }
    .manual-input.show { display: block; }
    .btn-group { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1.25rem; }
    button {
      width: 100%; padding: 0.75rem; border-radius: 10px; border: none;
      font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .primary { background: linear-gradient(135deg, #4361ee, #3a86ff); color: white; }
    .primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .primary:active { transform: translateY(0); }
    .secondary { background: rgba(255,255,255,0.06); color: #8892a4; }
    .secondary:hover { background: rgba(255,255,255,0.1); color: #c0c8d4; }
    .outline { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #8892a4; }
    .outline:hover { border-color: rgba(255,255,255,0.3); color: #c0c8d4; }
    .msg { margin-top: 1rem; padding: 0.75rem; border-radius: 10px; font-size: 0.88rem; display: none; line-height: 1.4; }
    .msg.error { background: rgba(239,68,68,0.15); color: #fca5a5; display: block; border: 1px solid rgba(239,68,68,0.2); }
    .msg.success { background: rgba(34,197,94,0.15); color: #86efac; display: block; border: 1px solid rgba(34,197,94,0.2); }
    .msg.info { background: rgba(59,130,246,0.15); color: #93c5fd; display: block; border: 1px solid rgba(59,130,246,0.2); }
    .divider { height: 1px; background: rgba(255,255,255,0.08); margin: 1.25rem 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; vertical-align: middle; margin-right: 0.4rem; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <div class="brand-logo">${LOGO_SVG}</div>
      <div class="brand-text"><strong>Masjid</strong>Connect</div>
    </div>
    <h1>Wi-Fi Setup</h1>
    <p class="subtitle" id="status">Connect your display to the internet to get started.</p>
    <div id="msg" class="msg"></div>
    <div class="form-group">
      <label for="ssid">Network</label>
      <select id="ssid" style="margin-bottom:0.4rem"><option value="">Loading networks…</option></select>
      <div style="margin-top:0.3rem">
        <span class="manual-toggle" id="manualToggle">My network isn't listed — enter manually</span>
      </div>
      <div class="manual-input" id="manualInput">
        <input type="text" id="manualSsid" placeholder="Enter exact network name (SSID)">
      </div>
    </div>
    <div class="form-group">
      <label for="password">Password</label>
      <input type="password" id="password" placeholder="Wi-Fi password" autocomplete="off">
    </div>
    <div class="form-group">
      <label for="country">Country</label>
      <input type="text" id="country" value="GB" placeholder="e.g. GB" maxlength="2" style="text-transform:uppercase;width:80px;">
    </div>
    <div class="btn-group">
      <button type="button" class="primary" id="connect">Connect</button>
      <button type="button" class="outline" id="scan">Scan for networks</button>
      <button type="button" class="secondary" id="skip">Skip — start display offline</button>
    </div>
  </div>
  <script>
    const msgEl = document.getElementById('msg');
    const ssidEl = document.getElementById('ssid');
    const manualSsidEl = document.getElementById('manualSsid');
    const passwordEl = document.getElementById('password');
    const countryEl = document.getElementById('country');
    const manualInput = document.getElementById('manualInput');
    const manualToggle = document.getElementById('manualToggle');
    let useManual = false;

    function showMsg(text, type) { msgEl.textContent = text; msgEl.className = 'msg ' + (type||'info'); }
    function clearMsg() { msgEl.className = 'msg'; }

    manualToggle.onclick = () => {
      useManual = !useManual;
      manualInput.classList.toggle('show', useManual);
      ssidEl.style.display = useManual ? 'none' : '';
      manualToggle.textContent = useManual ? 'Select from scanned networks' : 'Enter network name manually';
    };

    function getSelectedSsid() {
      return useManual ? (manualSsidEl.value || '').trim() : ssidEl.value.trim();
    }

    document.getElementById('scan').onclick = async () => {
      clearMsg();
      document.getElementById('scan').disabled = true;
      document.getElementById('scan').innerHTML = '<span class="spinner"></span>Scanning…';
      try {
        const r = await fetch('/api/scan');
        const d = await r.json();
        const list = d.ssids || [];
        ssidEl.innerHTML = '<option value="">— Select network —</option>' +
          list.map(s => '<option value="'+s.replace(/"/g,'&quot;')+'">'+s.replace(/</g,'&lt;')+'</option>').join('');
        showMsg(list.length ? 'Found '+list.length+' network(s).'+(d.cached?' (cached from initial scan)':'') : (d.error||'No networks found.'), list.length?'success':'info');
      } catch(e) { showMsg('Scan failed: '+e.message,'error'); }
      document.getElementById('scan').disabled = false;
      document.getElementById('scan').textContent = 'Scan for networks';
    };

    document.getElementById('connect').onclick = async () => {
      const ssid = getSelectedSsid();
      const password = passwordEl.value;
      const country = (countryEl.value||'GB').toUpperCase().slice(0,2);
      if (!ssid) { showMsg('Please select or enter a network name.','error'); return; }
      clearMsg();
      const btn = document.getElementById('connect');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Connecting…';
      try {
        const r = await fetch('/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ssid,password,country})});
        const d = await r.json();
        if (d.ok) {
          if (d.apMode) {
            showMsg(d.message||'Connecting… The hotspot will disappear. Please reconnect to your normal Wi-Fi and check your display.','info');
          } else {
            showMsg('Credentials saved. Checking connection…','info');
            for (let i=0;i<15;i++) {
              await new Promise(r=>setTimeout(r,1000));
              try {
                const s = await fetch('/api/status').then(r=>r.json());
                if (s.connected) { showMsg('Connected! The display will start shortly.','success'); btn.disabled=false; btn.textContent='Connect'; return; }
              } catch(_) {}
            }
            showMsg('Connection may still be in progress. You can start the display.','info');
          }
        } else { showMsg(d.error||'Connection failed.','error'); }
      } catch(e) { showMsg('Request failed: '+e.message,'error'); }
      btn.disabled = false;
      btn.textContent = 'Connect';
    };

    document.getElementById('skip').onclick = async () => {
      try {
        await fetch('/api/start-display',{method:'POST'});
        showMsg('Starting display in offline mode…','info');
      } catch(e) { showMsg('Could not continue: '+e.message,'error'); }
    };

    // Auto-check if we are already connected
    (async () => {
      try {
        const s = await fetch('/api/status').then(r=>r.json());
        if (s.connected) {
          document.getElementById('status').textContent = 'Internet detected! You can start the display.';
          showMsg('Your display is already connected to the internet.','success');
        }
      } catch(_) {}
    })();

    // Auto-scan on load
    document.getElementById('scan').click();
  </script>
</body>
</html>`;


// =============================================================================
// HTML — Instructions page shown on the Pi's own display (AP mode only)
// =============================================================================

const INSTRUCTIONS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MasjidConnect — Wi-Fi Setup</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; cursor: none; user-select: none; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #0f1729 0%, #1a2744 50%, #0d2137 100%);
      color: #e8ecf1;
    }
    .container { text-align: center; max-width: 800px; padding: 2rem; }
    .brand { display: flex; align-items: center; justify-content: center; gap: 0.8rem; margin-bottom: 2.5rem; }
    .brand-logo { width: 56px; height: 56px; flex-shrink: 0; }
    .brand-text {
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 1.6rem; font-weight: 400; color: #fff; letter-spacing: -0.01em;
    }
    .brand-text strong { font-weight: 700; }
    h1 { font-size: 2.4rem; font-weight: 700; margin-bottom: 0.6rem; color: #fff; }
    .subtitle { font-size: 1.15rem; color: #8892a4; margin-bottom: 2.5rem; }
    .steps {
      display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap;
      margin-bottom: 2.5rem;
    }
    .step {
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px; padding: 1.5rem 1.25rem; width: 220px; text-align: center;
    }
    .step-num {
      width: 36px; height: 36px; background: linear-gradient(135deg, #4361ee, #3a86ff);
      border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
      font-size: 1rem; font-weight: 700; color: white; margin-bottom: 0.75rem;
    }
    .step-title { font-size: 1rem; font-weight: 600; margin-bottom: 0.4rem; color: #fff; }
    .step-desc { font-size: 0.88rem; color: #8892a4; line-height: 1.45; }
    .highlight {
      display: inline-block; background: rgba(67,97,238,0.15); color: #93c5fd;
      padding: 0.15rem 0.5rem; border-radius: 6px; font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.85rem; font-weight: 600; letter-spacing: 0.3px;
    }
    .status-bar {
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px; padding: 1rem 1.5rem; display: inline-flex;
      align-items: center; gap: 0.75rem; font-size: 0.95rem;
    }
    .status-dot {
      width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
    }
    .status-dot.waiting { background: #f59e0b; animation: pulse 2s ease-in-out infinite; }
    .status-dot.connecting { background: #3b82f6; animation: pulse 1s ease-in-out infinite; }
    .status-dot.connected { background: #22c55e; }
    .status-dot.error { background: #ef4444; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    .error-msg { color: #fca5a5; font-size: 0.9rem; margin-top: 0.75rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">
      <div class="brand-logo">${LOGO_SVG}</div>
      <div class="brand-text"><strong>Masjid</strong>Connect</div>
    </div>
    <h1>Wi-Fi Setup</h1>
    <p class="subtitle">Follow these steps on your phone or laptop to connect this display to Wi-Fi</p>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-title">Connect to Hotspot</div>
        <div class="step-desc">On your phone, connect to the Wi-Fi network<br><span class="highlight">MasjidConnect-Setup</span></div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-title">Open Setup Page</div>
        <div class="step-desc">Open your browser and go to<br><span class="highlight">192.168.4.1</span></div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-title">Enter Wi-Fi Details</div>
        <div class="step-desc">Select your masjid's network, enter the password, and tap Connect</div>
      </div>
    </div>
    <div class="status-bar">
      <div class="status-dot waiting" id="statusDot"></div>
      <span id="statusText">Waiting for Wi-Fi configuration…</span>
    </div>
    <div class="error-msg" id="errorMsg" style="display:none"></div>
  </div>
  <script>
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const errorMsg = document.getElementById('errorMsg');

    let startDisplayCalled = false;
    async function poll() {
      try {
        const r = await fetch('/api/status');
        const s = await r.json();
        if (s.connected) {
          dot.className = 'status-dot connected';
          text.textContent = 'Connected! Starting display…';
          errorMsg.style.display = 'none';
          // Write the flag file — retry a few times to be sure
          if (!startDisplayCalled) {
            startDisplayCalled = true;
            for (let attempt = 0; attempt < 5; attempt++) {
              try {
                await fetch('/api/start-display', { method: 'POST' });
                break;
              } catch(_) { await new Promise(r => setTimeout(r, 500)); }
            }
          }
          // Keep polling briefly so the display status stays visible
          setTimeout(poll, 3000);
          return;
        }
        if (s.connecting) {
          dot.className = 'status-dot connecting';
          text.textContent = 'Connecting to Wi-Fi…';
          errorMsg.style.display = 'none';
        } else if (s.retryError) {
          dot.className = 'status-dot error';
          text.textContent = 'Connection failed — please try again from your phone';
          errorMsg.textContent = s.retryError;
          errorMsg.style.display = 'block';
        } else {
          dot.className = 'status-dot waiting';
          text.textContent = 'Waiting for Wi-Fi configuration…';
          errorMsg.style.display = 'none';
        }
      } catch(_) {
        // Server might be restarting during AP teardown — keep polling
      }
      setTimeout(poll, 2000);
    }
    poll();
  </script>
</body>
</html>`;


// =============================================================================
// HTML — No Wi-Fi adapter detected (shown when iw dev finds no wireless interface)
// =============================================================================

const NO_WIFI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MasjidConnect — No Wi-Fi adapter</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; cursor: none; user-select: none; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #0f1729 0%, #1a2744 50%, #0d2137 100%);
      color: #e8ecf1;
    }
    .container { text-align: center; max-width: 720px; padding: 2rem; }
    .brand { display: flex; align-items: center; justify-content: center; gap: 0.8rem; margin-bottom: 2rem; }
    .brand-logo { width: 56px; height: 56px; flex-shrink: 0; }
    .brand-text {
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 1.6rem; font-weight: 400; color: #fff; letter-spacing: -0.01em;
    }
    .brand-text strong { font-weight: 700; }
    h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 0.6rem; color: #fff; }
    .subtitle { font-size: 1.05rem; color: #8892a4; margin-bottom: 1.5rem; line-height: 1.5; }
    .options { text-align: left; background: rgba(255,255,255,0.04); border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 2rem; }
    .options li { margin-bottom: 0.5rem; color: #c0c8d4; }
    .options li:last-child { margin-bottom: 0; }
    .btn {
      display: inline-block; padding: 0.85rem 2rem; border-radius: 10px; border: none;
      font-size: 1rem; font-weight: 600; cursor: pointer;
      background: linear-gradient(135deg, #4361ee, #3a86ff); color: white;
    }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">
      <div class="brand-logo">${LOGO_SVG}</div>
      <div class="brand-text"><strong>Masjid</strong>Connect</div>
    </div>
    <h1>No Wi-Fi adapter detected</h1>
    <p class="subtitle">This display has no built-in or detected wireless interface, so the Wi-Fi hotspot setup cannot run.</p>
    <div class="options">
      <p style="margin:0 0 0.5rem 0; color:#93c5fd; font-weight:600;">You can:</p>
      <ul>
        <li><strong>Connect via Ethernet</strong> — plug in a network cable before powering on; the unit will skip Wi-Fi setup and use the internet when available.</li>
        <li><strong>Use a USB Wi-Fi adapter</strong> — plug in a compatible adapter and reboot; the setup may then detect it.</li>
      </ul>
    </div>
    <p class="subtitle">To continue without internet (offline mode), press the button below.</p>
    <button type="button" class="btn" id="continue">Continue to display</button>
  </div>
  <script>
    document.getElementById('continue').onclick = async function() {
      this.disabled = true;
      this.textContent = 'Starting…';
      try {
        await fetch('/api/start-display', { method: 'POST' });
      } catch { }
      this.textContent = 'Display will start shortly.';
    };
  </script>
</body>
</html>`;


// =============================================================================
// Captive portal probe paths — redirect to / so phones auto-open the setup page
// =============================================================================

const CAPTIVE_PORTAL_PATHS = new Set([
  '/generate_204',           // Android
  '/gen_204',                // Android alt
  '/hotspot-detect.html',    // Apple iOS / macOS
  '/library/test/success.html', // Apple alt
  '/connecttest.txt',        // Windows
  '/redirect',               // Windows alt
  '/ncsi.txt',               // Windows NCSI
  '/success.txt',            // Firefox
  '/canonical.html',         // Chromium
]);

function isCaptivePortalProbe(pathname) {
  return CAPTIVE_PORTAL_PATHS.has(pathname.toLowerCase());
}


// =============================================================================
// HTTP server
// =============================================================================

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  // Captive portal probes — redirect to setup page (AP mode only)
  if (AP_MODE && isCaptivePortalProbe(pathname)) {
    redirect(res, 'http://192.168.4.1/');
    return;
  }

  // Phone-facing setup page
  if (pathname === '/' || pathname === '/index.html') {
    send(res, 200, HTML, 'text/html; charset=utf-8');
    return;
  }

  // Pi display instructions page (AP mode)
  if (pathname === '/instructions') {
    send(res, 200, INSTRUCTIONS_HTML, 'text/html; charset=utf-8');
    return;
  }

  // No Wi-Fi adapter screen (when iw dev finds no wireless interface)
  if (pathname === '/no-wifi') {
    send(res, 200, NO_WIFI_HTML, 'text/html; charset=utf-8');
    return;
  }

  if (pathname === '/api/scan' && req.method === 'GET') {
    send(res, 200, handleScan());
    return;
  }

  if (pathname === '/api/connect' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      send(res, 200, handleConnect(body));
    } catch {
      send(res, 400, { ok: false, error: 'Invalid JSON' });
    }
    return;
  }

  if (pathname === '/api/status' && req.method === 'GET') {
    send(res, 200, handleStatus());
    return;
  }

  if (pathname === '/api/start-display' && (req.method === 'GET' || req.method === 'POST')) {
    send(res, 200, handleStartDisplay());
    return;
  }

  // In AP mode, any unknown path gets redirected to / (captive portal behaviour)
  if (AP_MODE) {
    redirect(res, 'http://192.168.4.1/');
    return;
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  const mode = AP_MODE ? `AP mode (hotspot, iface=${IFACE})` : 'local mode';
  process.stderr.write(`[MasjidConnect] WiFi setup server at http://${HOST}:${PORT} [${mode}]${DEV ? ' (dev — mock scan/connect)' : ''}\n`);
});

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });
