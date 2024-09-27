from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from bson import ObjectId
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from starlette.requests import Request
from pydantic import BaseModel

import json
from typing import Dict, List, Optional, Any
import uvicorn

app = FastAPI()

# CORS settings
app.add_middleware(
   CORSMiddleware,
   allow_origins=["http://localhost:3000"],  # Frontend URL
   allow_credentials=True,
   allow_methods=["*"],
   allow_headers=["*"],
)

# Templates and static files
templates = Jinja2Templates(directory="src")
# app.mount("/static", StaticFiles(directory="src/static"), name="static")

# MongoDB connection
client = MongoClient("mongodb://localhost:27017/")
db = client.chat_db

@app.get("/api")
def read_root():
   return {"message": "Hello from FastAPI"}

class ConnectionManager:
   def __init__(self):
       self.active_connections: Dict[str, List[WebSocket]] = {}
       self.group_connections: Dict[str, List[WebSocket]] = {}  # For group chats

   async def connect(self, websocket: WebSocket, username: str, group_id: str = None):
       await websocket.accept()
       if username not in self.active_connections:
           self.active_connections[username] = []
       self.active_connections[username].append(websocket)

       # if group_id:
       #     if group_id not in self.group_connections:
       #         self.group_connections[group_id] = []
       #     self.group_connections[group_id].append(websocket)

   def disconnect(self, websocket: WebSocket, username: str, group_id: str = None):
       if username in self.active_connections:
           self.active_connections[username].remove(websocket)
           if not self.active_connections[username]:
               del self.active_connections[username]

       if group_id and group_id in self.group_connections:
           self.group_connections[group_id].remove(websocket)
           if not self.group_connections[group_id]:
               del self.group_connections[group_id]

   async def send_personal_message(self, message: str, sender: str, receiver: str):
       print("ppppppppppp",message,sender,receiver)

       for connection in self.active_connections.get(receiver, []):
           try:
               await connection.send_json(message)
           except RuntimeError:
               self.disconnect(connection, receiver)
       for connection in self.active_connections.get(sender, []):
           try:
               await connection.send_json(message)
           except RuntimeError:
               self.disconnect(connection, sender)

   async def send_group_message(self, message: str, group_members: str):
       print("llllll",message,group_members)
       for member in group_members:
           for connection in self.active_connections.get(member, []):
               try:
                   await connection.send_json(message)
               except RuntimeError:
                   self.disconnect(connection, member)

manager = ConnectionManager()

@app.websocket("/chat/{username}/{receiver}")
async def chat_endpoint(websocket: WebSocket, username: str, receiver: str):
   print("username00000000",username,receiver)
 
   await manager.connect(websocket, username)

   try:
       while True:
           data = await websocket.receive_json()
           message_id = data.get('id')
           action = data.get('action')
           group_id = data.get('groupId')
           group_members = data.get('groupMembers')

           print("group---",group_members)
           if group_id:
               if action == 'delete' and message_id:
                   db.messages.delete_one({"_id": ObjectId(message_id)})
                   delete_message_data = {"_id": message_id, "action": "delete"}
                   await manager.send_group_message(delete_message_data, group_id)
               elif message_id:
                   db.messages.update_one(
                       {'_id': ObjectId(message_id)},
                       {'$set': {'message': data['message']}},
                   )
                   data['sender'] = username
                   data['receiver'] = group_id
                   data['_id'] = message_id
                   await manager.send_group_message(data, group_id)
               else:
                   data['sender'] = username
                   data['receiver'] = group_id
                   result = db.messages.insert_one(data)
                   data['_id'] = str(result.inserted_id)
                   await manager.send_group_message(data, group_members)

           else:  # One-to-one chat
               if action == 'delete' and message_id:
                   db.messages.delete_one({"_id": ObjectId(message_id)})
                   delete_message_data = {"_id": message_id, "action": "delete"}
                   await manager.send_personal_message(delete_message_data, username, receiver)
               elif message_id:
                   db.messages.update_one(
                       {'_id': ObjectId(message_id)},
                       {'$set': {'message': data['message']}},
                   )
                   data['sender'] = username
                   data['receiver'] = receiver
                   data['_id'] = message_id
                   await manager.send_personal_message(data, username, receiver)
               else:
                   data['sender'] = username
                   data['receiver'] = receiver
                   result = db.messages.insert_one(data)
                   data['_id'] = str(result.inserted_id)
                   await manager.send_personal_message(data, username, receiver)
       if group_id:
           manager.disconnect(websocket, username, group_id)
   except WebSocketDisconnect:
           manager.disconnect(websocket, username)
   except Exception as e:
       print(f"Error: {e}")
       manager.disconnect(websocket, username)

@app.get("/users/{user}")
async def get_users(user: str):
   # Replace this with your actual user fetching logic from your database
   users = db.Users.find({}, {"_id": 0, "user_name": 1})
   chat_groups = db.chatGroups.find()
   chat_groups_list = []
 
   for chat in chat_groups:
       if user in chat['group_members']:
           chat['_id'] = str(chat['_id'])  # Convert ObjectId to string if you need to return the ID
           chat_groups_list.append(chat)
 
   return {"users":[user['user_name'] for user in users], "chatGroups": chat_groups_list}

@app.get("/chat_history/{username}/{receiver}")
async def get_chat_history(username: str, receiver: str):
   chat_history = db.messages.find({
       "$or": [
           {"sender": username, "receiver": receiver},
           {"sender": receiver, "receiver": username}
       ]
   }).sort("_id", -1).limit(50)
   result = []
   for msg in chat_history:
       result.append({
           "message": msg.get('message', ''),
           "sender": msg.get('sender', 'Unknown'),
           "id": str(msg.get('_id', ''))
       })
   return result

@app.get("/group_history/{username}/{groupid}")
async def get_group_history(request: Request, username: str, groupid: str):
   print("Function get_group_history is called")
   try:
       # Fetch chat history from database
       chat_history_cursor = db.messages.find({
           "$and": [
               {"groupId": groupid},
             
           ]
       }).sort("_id", -1).limit(50)
     
       chat_history = list(chat_history_cursor)  # Convert cursor to list
 
       result = []
       for msg in chat_history:
           result.append({
               "message": msg.get('message', ''),
               "sender": msg.get('sender', 'Unknown'),
               "id": str(msg.get('_id', ''))
           })
     
       return result
   except Exception as e:
       raise HTTPException(status_code=500, detail=str(e))


@app.get('/')
async def get_chat(request: Request):
   messages = db.messages.find()
   users = db.Users.find()

   # Convert ObjectId to string for front-end
   for message in messages:
       message['_id'] = str(message['_id'])
   for user in users:
       user['_id'] = str(user['_id'])
   return templates.TemplateResponse("index.html", {"request": request, "messages": messages, "users": users})

@app.post("/login")
async def login(request: Request):
   data = await request.json()
   user_name = data.get("user_name")
   password = data.get("password")

   user = db.Users.find_one({"user_name": user_name})
   if user:
       user['_id'] = str(user['_id'])
       return {"message": "User found", "user": user}
   else:
       result = db.Users.insert_one({"user_name": user_name, "password": password})
       user = {"user_name": user_name, "password": password}
       return {"message": "User created", "user": user}

# Define the ChatGroup model
class ChatGroup(BaseModel):
   user_name: str
   group_name: str
   group_members: List[str]

@app.post("/create/group")
async def create_group_chat(chat_group: ChatGroup):     
   existing_group = db.chatGroups.find_one({"group_name": chat_group.group_name})
 
   if existing_group:
       raise HTTPException(status_code=400, detail="Group already exists.")
   chat_group.group_members.append(chat_group.user_name)
   new_group = {
       'user_name': chat_group.user_name,
       'group_name': chat_group.group_name,
       'group_members': chat_group.group_members
   }
 
   db.chatGroups.insert_one(new_group)
 
   return {"detail": "Group created successfully"}
@app.put("/update/group")
async def create_group_chat(request: Request):
   data = await request.json()
   group_id= data.get('group_id')
   group_name= data.get('group_name')
   group_members = data.get('group_members')

   existing_group = db.chatGroups.find_one({"_id": ObjectId(group_id)})

   if existing_group:
       db.chatGroups.update_one(
           {'_id': ObjectId(group_id)},  # Corrected query structure
           {
               '$set': {
                   'group_name': group_name,
                   'group_members': group_members
               }
           }
       )
       return {"detail": "Group update successfully"}
   else:
       raise HTTPException(status_code=400, detail="Group not exists.")
@app.delete("delete/group")
async def delete_group(request: Request):
   data = await request.json()
   group_id= data.get('group_id')
   print("delete",group_id)
   try:
       db.chatGroups.delete_one({"_id": ObjectId(group_id)})
       return {"detail": "Group delete successfully"}
   except Exception as e:
       print(f"Error: {e}")

@app.put("/messages/{message_id}")
async def update_message(message_id: str, request: Request):
   data = await request.json()
   message = data.get("message")
   if not message:
       raise HTTPException(status_code=400, detail="Message content is required")

   result = db.messages.update_one(
       {"_id": ObjectId(message_id)},
       {"$set": {"message": message}}
   )

   if result.matched_count == 0:
       raise HTTPException(status_code=404, detail="Message not found")

   return {"message": "Message updated successfully"}

@app.delete("/messages/{message_id}")
async def delete_message(message_id: str):
   result = db.messages.delete_one({"_id": ObjectId(message_id)})

   if result.deleted_count == 0:
       raise HTTPException(status_code=404, detail="Message not found")

   return {"message": "Message deleted successfully"}

if __name__ == "__main__":
   uvicorn.run(app, host="0.0.0.0", port=8000)
