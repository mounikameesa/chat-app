import React, { useState, useEffect } from "react";
import "./App.css";
import LoginPage from "./login";

function App() {
const [currentUser, setCurrentUser] = useState(null); // Set current user
const [selectedUser, setSelectedUser] = useState(null); // Set selected user
const [users, setUsers] = useState([]); // Set all users list
const [messages, setMessages] = useState([]); // Set all messages list
const [websocket, setWebsocket] = useState(null); // Set websocket
const [messageInput, setMessageInput] = useState(""); // Set message input
const [chatGroups, setChatGroups] = useState([]); // Set message input
const [selectGroups, setSelectedGroups] = useState([]); // Set message input
const [isShowModal, setIsShowModal] = useState(false)
const [groupMembers, setGroupMembers] = useState([])
const [groupName, setGroupName] = useState('')
const [emptyState, setEmptyState] = useState('')
const [groupId, setGroupId] = useState('')


useEffect(() => {
   // Set current user details
   const storedUser = JSON.parse(localStorage.getItem("userDetails"));
   if (storedUser) {
     setCurrentUser(storedUser); // Set current user
     fetchUsers(storedUser); // Fetch users list
   }
}, []);

useEffect(() => {
   if (selectedUser && currentUser) {
     fetchChatHistory(); // Fetch chat messages
     if (websocket) {
       websocket.close();
     }
     connectToSocket(); // Connect the socket
   }

}, [selectedUser, selectGroups]);

useEffect(() => {
   console.log("89899", selectGroups)
   if (selectGroups && currentUser) {
     fetchGroupChatHistory(); // Fetch chat messages
     connectToSocket(); // Connect the socket
   }
}, [selectGroups])
// Fetch users data
const fetchUsers = async (storedUser) => {
   const user = storedUser.user_name
   const response = await fetch(`http://127.0.0.1:8000/users/${user}`);
   console.log("response", response);
   const usersData = await response.json();
   console.log(usersData, "Fetched Users:", usersData.users);
   console.log("Fetched Chat Groups:", usersData.chatGroups);
   setUsers(usersData.users);

   setChatGroups(usersData.chatGroups)
};

// Fetch chat history
const fetchChatHistory = async () => {
   const response = await fetch(
     `http://127.0.0.1:8000/chat_history/${currentUser.user_name}/${selectedUser}`
   );
   const messagesData = await response.json();
   console.log("messagesData----+++++++=", messagesData)
   setMessages(messagesData.reverse()); // Set chat messages
};

const fetchGroupChatHistory = async () => {
   try {
     if (selectGroups && currentUser) {
       const response = await fetch(
         `http://127.0.0.1:8000/group_history/${currentUser.user_name}/${selectGroups._id}`
       );

       if (!response.ok) {
         throw new Error(`HTTP error! status: ${response.status}`);
       }

       const messagesData = await response.json();
       console.log("messagesData----+++++++=", messagesData);
       setMessages(messagesData.reverse()); // Set chat messages
     }
   } catch (error) {
     console.error("Failed to fetch group chat history:", error);
   }
};
// Connect to the respective web socket
const connectToSocket = () => {

   const user = selectedUser || selectGroups._id
   const ws = new WebSocket(
     `ws://localhost:8000/chat/${currentUser.user_name}/${user}`
   );

   // Listen the messages from socket
   ws.onmessage = (event) => {

     const data = JSON.parse(event.data);
     console.log("listen----", data)
     // After delete set messages
     if (data.action === "delete") {
       console.log("delete", data);
       setMessages((prevMessages) =>
         prevMessages.filter((msg) => {
           return msg.id !== data._id; // Return true to keep the message, false to remove it
         })
       );
     } else {
       setMessages((prevMessages) => {

         // Check if a message with the given _id exists
         const messageExists = prevMessages.some((msg) => {
           return msg.id === data._id;
         });

         // Update the message if it exists
         if (messageExists) {
           return prevMessages.map((msg) => {
             return msg.id === data._id ? data : msg;
           });
         } else {
           // Add the new message if it does not exist
           return [...prevMessages, data];
         }
       });
     }
   };
   ws.onerror = (error) => {
     console.error("WebSocket Error:", error);
   };
   ws.onclose = (event) => {
     if (event.code !== 1000) {
       // Non-normal closure
       console.error("WebSocket closed with code", event.code);
     }
   };
   setWebsocket(ws);
};

// Send messages to the server
const sendMessage = () => {
   if (messageInput.trim() === "") {
     alert("Please enter a message.");
     return;
   }
   // Prepare the data
   let messageData = {
     message: messageInput,
     user: currentUser.user_name,
     groupId: selectGroups._id ? selectGroups._id : '',
     groupMembers: selectGroups.group_members ? selectGroups.group_members : '',
   };
   console.log("electGroups._id", selectGroups)
   // if (selectGroups) {
   //   messageData.group_id = selectGroups._id; // Directly add group_id property
   // }
   console.log("--------------", messageData);
   websocket.send(JSON.stringify(messageData));
   setMessageInput("");
};

// Handle delete messages
const deleteMessage = (messageId) => {
   if (window.confirm("Are you sure you want to delete message"))
     websocket.send(JSON.stringify({ action: "delete", id: messageId }));
};

// Handle update the messages
const updateMessage = (message) => {
   websocket.send(
     JSON.stringify({
       action: "edit",
       id: message.id,
       message: message.message,
     })
   );
};

// Check user login or not
if (!currentUser) {
   return <LoginPage />;
}

return (
   <div className="App">
     <h1>
       Chat with your friend <span>{selectedUser}</span>
     </h1>
     <h3>
       Current User: <span>{currentUser.user_name}</span>
     </h3>
     <button onClick={() => {
       setGroupName('')
       setGroupMembers('')
       setIsShowModal(true)
     }}>Create</button>

     <div>
       <CreateGroupChat
         users={users}
         currentUser={currentUser}
         isShowModal={isShowModal}
         groupMembers={groupMembers}
         groupName={groupName}
         emptyState={emptyState}
         setGroupMembers={setGroupMembers}
         setGroupName={setGroupName}
         setEmptyState={setEmptyState}
         setIsShowModal={setIsShowModal}
         chatGroups={chatGroups}
         groupId={groupId}
       />
     </div>
     <div id="container">

       <UserList
         chatGroups={chatGroups}
         currentUser={currentUser}
         users={users}
         setSelectedUser={setSelectedUser}
         setSelectedGroups={setSelectedGroups}
         selectedUser={selectedUser}
         setIsShowModal={setIsShowModal}
         setGroupName={setGroupName}
         setGroupMembers={setGroupMembers}
         setGroupId={setGroupId}
       />

       <ChatBox
         messages={messages}
         sendMessage={sendMessage}
         setMessageInput={setMessageInput}
         messageInput={messageInput}
         deleteMessage={deleteMessage}
         updateMessage={updateMessage}
         selectedUser={selectedUser}
       />
     </div>
   </div>
);
}

// Create group
function CreateGroupChat({
emptyState,
groupName,
groupMembers,
users,
selectedUser,
setSelectedUser,
currentUser,
setSelectedGroups,
isShowModal,
setIsShowModal,
setGroupMembers,
setGroupName,
chatGroups,
setEmptyState,
groupId }) {

console.log("id0000000000000", groupId);

const handleCheckboxChange = (user) => {
   setEmptyState('')
   setGroupMembers((prevMembers) => {
     if (prevMembers.includes(user)) {
       // Remove the user if already selected
       return prevMembers.filter((member) => member !== user);
     } else {
       // Add the user if not already selected
       return [...prevMembers, user];
     }
   });
};
console.log("232323", groupName, groupMembers)
console.log(chatGroups, "???????????????", groupMembers)

const createNewGroup = async () => {
   if (!groupMembers.length)
     return setEmptyState('Please select any one of your friend to create group')
   setIsShowModal(false);
   setEmptyState('')
   const ChatGroup = {
     group_id: groupId,
     user_name: currentUser.user_name,
     group_members: groupMembers,

     group_name: groupName,
   }
   console.log(ChatGroup,"8888888888", groupId);

   await fetch(`${groupId?'http://127.0.0.1:8000/update/group':'http://127.0.0.1:8000/create/group'}`, {
     method: `${groupId?'PUT':'POST'}`,
   
     body: JSON.stringify({
       group_id: groupId,
       user_name: currentUser.user_name,
       group_members: groupMembers,
        group_name: groupName,
     })
   })
}
return (
   <div>
     {isShowModal &&
       <div className="create-group-modal">


         <form onSubmit={() => createNewGroup()} >
           <div style={{ minHeight: '150px', maxHeight: '150px', overflowY: 'auto', backgroundColor: 'black', color: 'white' }}>
             <p>{emptyState}</p>
             {users.map((user) => (
               user !== currentUser.user_name && (<div style={{ display: 'flex' }}>
                 <input type="checkbox" onClick={() => handleCheckboxChange(user)} checked={groupMembers.includes(user)}></input>

                 <div
                   key={user}
                 >
                   {user}
                 </div>

               </div>)
             ))
             }
           </div>
           <div style={{ marginTop: '10px' }}>
             <input type="text" placeholder="Please enter group name" value={groupName} required onChange={(e) => setGroupName(e.target.value)} />
             <div style={{ display: 'flex' }}>
               <button type="submit">Save</button>
               <button type="cancel" onClick={() => setIsShowModal(false)}>Cancel</button>
             </div>
           </div>
         </form>
       </div>
     }
   </div>
)
}

// Display users list
function UserList({ chatGroups, users, setSelectedUser, selectedUser, currentUser, setSelectedGroups, setIsShowModal, setGroupName, setGroupMembers, setGroupId }) {
console.log("opppppppppppppppp", chatGroups)
const deleteGroup=async (id)=>{
   if(window.confirm()){
     await fetch('http://127.0.0.1:8000/delete/group', {
       method: `DELETE`,
     
       body: JSON.stringify({
         group_id: id,
       })
     })
   }

}
return (
   <div id="user-list">
     <p style={{ color: 'white' }}> Chats :</p>
     {users.map((user) => (
       <div
         key={user}
         className="user-item"
         style={{ backgroundColor: user === selectedUser ? "#d5c7a1" : "" }}
         onClick={() => setSelectedUser(user)}
       >
         {user}
       </div>
     ))}
     <p style={{ color: 'white' }}>Groups :</p>
     {
       chatGroups.map((chat, index) => (
         <div key={index} className="user-item" style={{
           backgroundColor: chat.group_name === selectedUser ? "#d5c7a1" : "",
         }}
           onClick={() => setSelectedGroups(chat)}
         >

           <span>{chat.group_name}</span>
           <span>({chat.group_members.join(', ')})</span>
           <button onClick={() => {
             setGroupName(chat.group_name)
             setGroupMembers(chat.group_members)
             setGroupId(chat._id)
             setIsShowModal(true)
           }}>edit </button>
           <button onClick={()=>deleteGroup(chat._id)}>delete</button>

         </div>
       ))}
   </div>
);
}

// Display chat box
function ChatBox({
messages,
sendMessage,
setMessageInput,
messageInput,
deleteMessage,
updateMessage,
selectedUser
}) {
console.log("messages-------", messages)
return (
   <div id="chat-box">
     <div id="chat-messages">
       {messages.length > 0 ? (
         messages.map((msg) => {
           return (
             <ChatMessage
               key={msg.id}
               message={msg}
               deleteMessage={deleteMessage}
               updateMessage={updateMessage}
             />
           );
         })
       ) : (
         <p
           style={{ marginTop: "200px", textAlign: "center", color: "white" }}
         >
           {selectedUser ? 'No chat details found' : 'Please select a user to chat with one of your friend and view chat details....'}
         </p>
       )}
     </div>
     <div id="message-input-container">
       <input
         type="text"
         id="message-input"
         placeholder="Enter your message..."
         value={messageInput}
         onChange={(e) => setMessageInput(e.target.value)}
       />
       <button id="send-button" onClick={sendMessage}>
         Send
       </button>
     </div>
   </div>
);
}

// Display chat messages
function ChatMessage({ message, deleteMessage, updateMessage }) {
const isUser = message.sender === JSON.parse(localStorage.getItem("userDetails")).user_name;
const [isShow, setIsShow] = useState(false);
const [messageValue, setMessageValue] = useState("");

// Handle scroll event
useEffect(() => {
   const chatMessagesDiv = document.getElementById("chat-messages");
   // Scroll to the bottom of the chat
   if (chatMessagesDiv) {
     chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
   }
}, [message]); // This effect will run every time the messages array changes

// Handle edit messages
const editMessage = (message) => {
   setMessageValue(message.message);
   setIsShow(true);
};
return (
   <div
     className={`chat-message ${isUser ? "user" : "other"}`}
     data-id={message._id || message.id}
   >
     <div className="message-content">
       <strong>{isUser ? "You" : message.sender}:</strong>
       {!isShow ? (
         <div className="message">{message.message}</div>
       ) : (
         <input
           type="text"
           value={messageValue}
           onChange={(e) => setMessageValue(e.target.value)}
         />
       )}

     </div>
     {isUser && (
       <div className="actionButtons">
         {!isShow && (
           <div>
             <button
               className="edit-button"
               onClick={() => editMessage(message)}
             >
               Edit
             </button>
             <button
               className="delete-button"
               onClick={() => deleteMessage(message.id || message._id)}
             >
               Delete
             </button>
           </div>
         )}
         {isShow && (
           <div className="update-actions">
             <button
               className="update-button"
               onClick={() => {
                 updateMessage({
                   id: message._id || message.id,
                   message: messageValue,
                 });
                 setIsShow(false);
               }}
             >
               Update
             </button>
             <button
               className="cancel-button"
               onClick={() => {
                 setIsShow(false);
               }}
             >
               Cancel
             </button>
           </div>
         )}
       </div>
     )}
   </div>
);
}

export default App;


 