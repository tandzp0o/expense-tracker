import json, base64

with open("serviceAccountKey.json") as f:
    sa = json.load(f)

key_b64 = base64.b64encode(sa["private_key"].encode()).decode()

# Chia làm 3 phần bằng nhau
size = len(key_b64) // 3
part1 = key_b64[:size]
part2 = key_b64[size:size*2]
part3 = key_b64[size*2:]

print(f"FIREBASE_PRIVATE_KEY_1={part1}")
print(f"FIREBASE_PRIVATE_KEY_2={part2}")
print(f"FIREBASE_PRIVATE_KEY_3={part3}")
print(f"\nTotal length: {len(key_b64)}, Each part: ~{size}")
