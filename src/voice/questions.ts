
export interface Question {
id: string;
text: string;
spoken: string;
}

export const QUESTIONS: Question[]=[
{
id: "open",
text: "How is it right now?",
spoken: "How is it right now?",
},
{
id: "where",
text: "Where is it, and how does it feel?",
spoken: "Where is it?",
},
{
id: "seeing",
text: "Are you seeing anything?",
spoken: "Are you seeing anything?",
},
{
id: "taken",
text: "Have you taken anything?",
spoken: "Taken anything?",
},
{
id: "else",
text: "Anything else you want on the record?",
spoken: "Anything else?",
},
];
