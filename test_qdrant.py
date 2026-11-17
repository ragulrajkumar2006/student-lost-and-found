
from sentence_transformers import SentenceTransformer
import requests

# Connect to the embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

QDRANT_URL = "http://localhost:6333"
COLLECTION = "lost_found_items"

# Sample lost and found items
items = [
    {
        "id": 1,
        "description": "I lost my black leather wallet near the library",
        "type": "LOST"
    },
    {
        "id": 2,
        "description": "A dark leather purse was found beside the library",
        "type": "FOUND"
    },
    {
        "id": 3,
        "description": "I lost my blue water bottle in the classroom",
        "type": "LOST"
    }
]

# Generate vectors
points = []

for item in items:
    vector = model.encode(item["description"]).tolist()

    points.append({
        "id": item["id"],
        "vector": vector,
        "payload": item
    })

# Insert into Qdrant
response = requests.put(
    f"{QDRANT_URL}/collections/{COLLECTION}/points",
    json={"points": points}
)

print("Insertion:", response.json())

# Search for similar items
query = "I found a black wallet near the college library"
query_vector = model.encode(query).tolist()


search_response = requests.post(
    f"{QDRANT_URL}/collections/{COLLECTION}/points/search",
    json={
        "vector": query_vector,
        "limit": 3,
        "with_payload": True
    }
)

print("\nSimilar items:")

data = search_response.json()

if "result" not in data:
    print("Search error:", data)
else:
    for result in data["result"]:
        print("Description:", result["payload"]["description"])
        print("Type:", result["payload"]["type"])
        print("Similarity:", round(result["score"], 4))
        print("--------------------")

print("\nSimilar items:")

for result in search_response.json()["result"]:
    print("Description:", result["payload"]["description"])
    print("Similarity:", result["score"])
    print("--------------------")
