import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    senderId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User"
    },
    receiverId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User"
    },
    message : {
        type : String

    },
    image:{
        type : String
       
    },
    video:{
        type : String 
    },
    publicId:{
        type : String
    },
    resourceType:{
        type : String
    },
    
},{timestamps : true})  

const Message = mongoose.model("Message", messageSchema);  
export default Message;