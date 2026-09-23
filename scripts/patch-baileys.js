/**
 * Automated patch for @whiskeysockets/baileys 7.0.0-rc14
 * 
 * Fixes critical upstream bugs:
 * 1. PR #2749: "fix(socket): ack nodes before login"
 *    Fixes TypeError: Cannot read properties of undefined (reading 'id') in sendMessageAck
 *    when notifications (companion_reg_refresh, link_code_companion_reg) arrive before login.
 * 2. PR #2765: "fix(socket): rotate the adv secret on companion_reg_refresh and re-render the QR"
 *    Fixes stalled pairing flow and immediate disconnect by handling companion_reg_refresh,
 *    rotating creds.advSecretKey, and re-rendering the pairing QR with the active secret.
 * 3. PR #2608: "fix: ignore empty link code companion reg"
 *    Prevents unhandled rejection when link_code_companion_reg arrives without pairing buffers.
 * 4. Pairing code cleanup: clears qrTimer when requestPairingCode is invoked.
 */

const fs = require('fs');
const path = require('path');

const baileysDir = path.join(__dirname, '..', 'node_modules', '@whiskeysockets', 'baileys');

if (!fs.existsSync(baileysDir)) {
  console.log('[patch-baileys] @whiskeysockets/baileys not found in node_modules, skipping patch.');
  process.exit(0);
}

let patchesApplied = 0;

// 1. Patch messages-recv.js
const messagesRecvPath = path.join(baileysDir, 'lib', 'Socket', 'messages-recv.js');
if (fs.existsSync(messagesRecvPath)) {
  let content = fs.readFileSync(messagesRecvPath, 'utf8');
  let modified = false;

  // Fix 1: sendMessageAck creds.me?.id
  const targetAck = "const stanza = buildAckStanza(node, errorCode, authState.creds.me.id);";
  const patchedAck = "const stanza = buildAckStanza(node, errorCode, authState.creds.me?.id);";
  if (content.includes(targetAck)) {
    content = content.replace(targetAck, patchedAck);
    modified = true;
    patchesApplied++;
    console.log('[patch-baileys] Applied PR #2749: safe creds.me?.id in sendMessageAck');
  }

  // Fix 1b: rejectCall creds.me?.id
  const targetReject = "from: authState.creds.me.id,";
  const patchedReject = "from: authState.creds.me?.id,";
  if (content.includes(targetReject)) {
    content = content.replace(targetReject, patchedReject);
    modified = true;
    patchesApplied++;
    console.log('[patch-baileys] Applied safe creds.me?.id in rejectCall');
  }

  // Fix 2: safe buffer extraction in case 'link_code_companion_reg':
  const targetLinkReg = `            case 'link_code_companion_reg':
                const linkCodeCompanionReg = getBinaryNodeChild(node, 'link_code_companion_reg');
                const ref = toRequiredBuffer(getBinaryNodeChildBuffer(linkCodeCompanionReg, 'link_code_pairing_ref'));
                const primaryIdentityPublicKey = toRequiredBuffer(getBinaryNodeChildBuffer(linkCodeCompanionReg, 'primary_identity_pub'));
                const primaryEphemeralPublicKeyWrapped = toRequiredBuffer(getBinaryNodeChildBuffer(linkCodeCompanionReg, 'link_code_pairing_wrapped_primary_ephemeral_pub'));`;

  const patchedLinkReg = `            case 'link_code_companion_reg':
                const linkCodeCompanionReg = getBinaryNodeChild(node, 'link_code_companion_reg');
                const rawRef = getBinaryNodeChildBuffer(linkCodeCompanionReg, 'link_code_pairing_ref');
                const rawPrimaryIdentity = getBinaryNodeChildBuffer(linkCodeCompanionReg, 'primary_identity_pub');
                const rawEphemeral = getBinaryNodeChildBuffer(linkCodeCompanionReg, 'link_code_pairing_wrapped_primary_ephemeral_pub');
                if (!rawRef || !rawPrimaryIdentity || !rawEphemeral) {
                    logger.debug({ id: node.attrs.id, type: node.attrs.type }, 'link_code_companion_reg notification without pairing data, skipping');
                    break;
                }
                const ref = toRequiredBuffer(rawRef);
                const primaryIdentityPublicKey = toRequiredBuffer(rawPrimaryIdentity);
                const primaryEphemeralPublicKeyWrapped = toRequiredBuffer(rawEphemeral);`;

  if (content.includes(targetLinkReg)) {
    content = content.replace(targetLinkReg, patchedLinkReg);
    modified = true;
    patchesApplied++;
    console.log('[patch-baileys] Applied PR #2608: safe link_code_companion_reg buffer guard');
  }

  if (modified) {
    fs.writeFileSync(messagesRecvPath, content, 'utf8');
  }
}

// 2. Patch socket.js
const socketPath = path.join(baileysDir, 'lib', 'Socket', 'socket.js');
if (fs.existsSync(socketPath)) {
  let content = fs.readFileSync(socketPath, 'utf8');
  let modified = false;

  // Fix 3: Clear qrTimer when requestPairingCode is invoked
  const targetReqPairing = `    const requestPairingCode = async (phoneNumber, customPairingCode) => {
        const pairingCode = customPairingCode ?? bytesToCrockford(randomBytes(5));`;

  const patchedReqPairing = `    const requestPairingCode = async (phoneNumber, customPairingCode) => {
        if (qrTimer) {
            clearTimeout(qrTimer);
        }
        const pairingCode = customPairingCode ?? bytesToCrockford(randomBytes(5));`;

  if (content.includes(targetReqPairing)) {
    content = content.replace(targetReqPairing, patchedReqPairing);
    modified = true;
    patchesApplied++;
    console.log('[patch-baileys] Applied requestPairingCode qrTimer cancel fix');
  }

  // Fix 4: Add companion_reg_refresh handler and dynamic QR re-rendering
  const targetQrHandler = `    // QR gen
    ws.on('CB:iq,type:set,pair-device', async (stanza) => {
        const iq = {
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'result',
                id: stanza.attrs.id
            }
        };
        await sendNode(iq);
        const pairDeviceNode = getBinaryNodeChild(stanza, 'pair-device');
        const refNodes = getBinaryNodeChildren(pairDeviceNode, 'ref');
        const noiseKeyB64 = Buffer.from(creds.noiseKey.public).toString('base64');
        const identityKeyB64 = Buffer.from(creds.signedIdentityKey.public).toString('base64');
        const advB64 = creds.advSecretKey;
        let qrMs = qrTimeout || 60000; // time to let a QR live
        const genPairQR = () => {
            if (!ws.isOpen) {
                return;
            }
            const refNode = refNodes.shift();
            if (!refNode) {
                void end(new Boom('QR refs attempts ended', { statusCode: DisconnectReason.timedOut }));
                return;
            }
            const ref = refNode.content.toString('utf-8');
            const qr = buildPairingQRData(ref, noiseKeyB64, identityKeyB64, advB64, browser);
            ev.emit('connection.update', { qr });
            qrTimer = setTimeout(genPairQR, qrMs);
            qrMs = qrTimeout || 20000; // shorter subsequent qrs
        };
        genPairQR();
    });`;

  const patchedQrHandler = `    // QR gen & companion_reg_refresh support (PR #2765)
    let refreshPairingQR;
    let currentPairingRef;
    ws.on('CB:iq,type:set,pair-device', async (stanza) => {
        const iq = {
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'result',
                id: stanza.attrs.id
            }
        };
        await sendNode(iq);
        const pairDeviceNode = getBinaryNodeChild(stanza, 'pair-device');
        const refNodes = getBinaryNodeChildren(pairDeviceNode, 'ref');
        const noiseKeyB64 = Buffer.from(creds.noiseKey.public).toString('base64');
        const identityKeyB64 = Buffer.from(creds.signedIdentityKey.public).toString('base64');
        let qrMs = qrTimeout || 60000; // time to let a QR live
        const genPairQR = () => {
            if (!ws.isOpen) {
                return;
            }
            const refNode = refNodes.shift();
            if (!refNode) {
                void end(new Boom('QR refs attempts ended', { statusCode: DisconnectReason.timedOut }));
                return;
            }
            const ref = refNode.content.toString('utf-8');
            currentPairingRef = ref;
            const qr = buildPairingQRData(ref, noiseKeyB64, identityKeyB64, creds.advSecretKey, browser);
            ev.emit('connection.update', { qr });
            qrTimer = setTimeout(genPairQR, qrMs);
            qrMs = qrTimeout || 20000; // shorter subsequent qrs
        };
        refreshPairingQR = () => {
            if (currentPairingRef && ws.isOpen) {
                const qr = buildPairingQRData(currentPairingRef, noiseKeyB64, identityKeyB64, creds.advSecretKey, browser);
                ev.emit('connection.update', { qr });
            }
        };
        genPairQR();
    });
    // the server retiring an unpaired companion's registration material
    ws.on('CB:notification,type:companion_reg_refresh', (node) => {
        if (creds.me) {
            logger.debug({ id: node.attrs.id }, 'companion_reg_refresh on a registered session; keeping adv secret');
            return;
        }
        creds.advSecretKey = randomBytes(32).toString('base64');
        ev.emit('creds.update', { advSecretKey: creds.advSecretKey });
        logger.info({ id: node.attrs.id }, 'rotated adv secret on companion_reg_refresh; re-rendering QR');
        if (typeof refreshPairingQR === 'function') {
            refreshPairingQR();
        }
    });`;

  if (content.includes(targetQrHandler)) {
    content = content.replace(targetQrHandler, patchedQrHandler);
    modified = true;
    patchesApplied++;
    console.log('[patch-baileys] Applied PR #2765: companion_reg_refresh rotation and QR re-rendering');
  }

  if (modified) {
    fs.writeFileSync(socketPath, content, 'utf8');
  }
}

console.log(`[patch-baileys] Patching complete. Applied ${patchesApplied} patches.`);
