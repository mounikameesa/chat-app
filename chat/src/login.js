import { useState } from "react";

// Login page
function LoginPage() {
   const [name, setName] = useState('');
   const [password, setPassword] = useState('');
   const [isShowUser, setIsShowUser] = useState(false);
   const [showMessage, setShowMessage] = useState('')
   // Handle submit form
   async function SubmitForm(event) {
       event.preventDefault(); // Prevent default form submission behavior
       console.log("isShowUser", isShowUser);

       const url = isShowUser ? 'http://127.0.0.1:8000/create' : 'http://127.0.0.1:8000/login'
       // Post login details
       const response = await fetch(url, {
           method: 'POST',
           headers: {
               'Content-Type': 'application/json', // Updated to 'application/json'
           },
           body: JSON.stringify({
               user_name: name,
               password: password,
           }),
       });
       const data = await response.json();
       console.log(data, "okk", response);

       if (response.ok) {
           if (data.login) {
               localStorage.setItem('userDetails', JSON.stringify(data.user));
               window.location.href = '/';  // Optionally, redirect or update the state to indicate successful login
           } else {
               setIsShowUser(true)
           }
           setShowMessage(data.message)


       } else {
           alert('Login failed: ' + data.detail);
       }
   }

   return (
       <div>
           {isShowUser
               ? <div className="create-user">
                   <h1>Create new user</h1>

                   <form id="createForm" onSubmit={SubmitForm}>
                       <input
                           id="user-name"
                           type="text"
                           placeholder="Username"
                           value={name}
                           onChange={(e) => setName(e.target.value)}
                           required
                       />
                       <input
                           id="user-password"
                           type="password"
                           placeholder="Password"
                           value={password}
                           onChange={(e) => setPassword(e.target.value)}
                           required
                       />
                       <button type="submit">Create user</button>
                   </form>
                   <p>{showMessage ? `Note : ${showMessage}` : ''}</p>
               </div>
               : <div className="login-page">
                   <h1>Please login to use the chat</h1>
                   <form id="loginForm" onSubmit={SubmitForm}>
                       <input
                           id="user-name"
                           type="text"
                           placeholder="Username"
                           value={name}
                           onChange={(e) => setName(e.target.value)}
                           required
                       />
                       <input
                           id="user-password"
                           type="password"
                           placeholder="Password"
                           value={password}
                           onChange={(e) => setPassword(e.target.value)}
                           required
                       />
                       <button type="submit">Login</button>
                   </form>
                   <p>{showMessage ? `Note : ${showMessage}` : ''}</p>

               </div>
           }
       </div>
   );
}

export default LoginPage;