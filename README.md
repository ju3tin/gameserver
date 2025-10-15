# gameserver


test messages are

CREATE_USER
{ "type": "CREATE_USER", "username": "alice", "walletAddress": "alice_wallet_123" }

PLACE_BET
{ "type": "PLACE_BET", "walletAddress": "alice_wallet_123", "amount": 50, "currency": "SOL" }

FINISH_BET
{ "type": "FINISH_BET", "walletAddress": "alice_wallet_123" }