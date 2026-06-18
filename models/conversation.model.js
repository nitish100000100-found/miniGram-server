import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    participants : [
        {
            type : mongoose.Schema.Types.ObjectId,
            ref : "User"
        }
    ],
    messages : [
        {
            type : mongoose.Schema.Types.ObjectId,
            ref : "Message"
        }
    ],
    lastMsgSentForId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User"
    },
    isSeen : {
        type : Boolean,
        default : false
    },
    deletedBy : [
        {
            userId : {
                type : mongoose.Schema.Types.ObjectId,
                ref : "User"
            },
            deletedAt : {
                type : Date,
                default : Date.now
            }
        }
    ]
    
},{timestamps : true})  

const Conversation = mongoose.model("Conversation", conversationSchema);  


export default Conversation;  
