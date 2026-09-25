// Administrator-only migration. Does not infer ownership from a shared link.
// Dry run is the default. Run only after reviewing the selected account UID(s).
const fs = require('node:fs');
const path = require('node:path');
const { admin } = require('../netlify/functions/lib/server');
async function main(){
 const args=process.argv.slice(2),read=name=>args[args.indexOf(name)+1];
 const roomId=read('--room'),ownerId=read('--owner');
 if(!args.includes('--room')||!args.includes('--owner')||!/^[a-f0-9]{40}$/.test(roomId)||!ownerId||/[.#$\[\]\/]/.test(ownerId))throw Error('Usage: node scripts/assign-room-owner.cjs --room ROOM_ID --owner ACCOUNT_UID [--editor ACCOUNT_UID] [--apply]');
 const db=admin(),room=(await db.ref(`rooms/${roomId}`).get()).val(),access=(await db.ref(`roomAccess/${roomId}`).get()).val();
 if(!room)throw Error('Room not found.');
 if(access||room.ownerId)throw Error('This room already has ownership metadata. No changes made.');
 const members={[ownerId]:'owner'};
 for(let i=0;i<args.length;i++)if(args[i]==='--editor'){const uid=args[i+1];if(!uid||/[.#$\[\]\/]/.test(uid))throw Error('Invalid editor UID.');if(uid!==ownerId)members[uid]='editor';}
 console.log(`Existing categories: ${Object.keys(room.sections||{}).length}. Proposed members: ${Object.keys(members).length}.`);
 if(!args.includes('--apply')){console.log('Dry run only. No database changes made. Add --apply after reviewing the account UIDs.');return;}
 const directory=path.resolve('backups');fs.mkdirSync(directory,{recursive:true,mode:0o700});const file=path.join(directory,`wardrobe-before-ownership-${Date.now()}.json`);fs.writeFileSync(file,JSON.stringify({roomId,room,access},null,2),{mode:0o600});
 // Update only ownership fields so concurrent checklist edits cannot be overwritten.
 await db.ref().update({[`rooms/${roomId}/ownerId`]:ownerId,[`rooms/${roomId}/schemaVersion`]:2,[`roomAccess/${roomId}`]:{ownerId,members}});
 console.log(`Ownership assigned. Backup saved to ${file}. Existing links keep the same room ID; only the named members now have access.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>process.exit());
