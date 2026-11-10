import {firebaseConfig} from './firebase-config.js';
import {createLeaderboard} from './leaderboard-service.js';
export const leaderboard=createLeaderboard({config:firebaseConfig,gameId:'slot_bakuhatu',maxScore:1000000,scoreAllowed:score=>score===0||(score>=10&&(score<=938793||score===1000000))});
