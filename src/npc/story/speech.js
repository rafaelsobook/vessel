export const storySpeech = [
    {
        npcID: "story-speech-1",
        normalSpeech: {
            type: "permanent", // once, permanent, conditional, random(means it is an array of possible speech)
            speech: "My name is Emilia Ashford, I greet you with my life, Now I bid you farewell and enjoy your slow fun journey here"
        },
        forQuests: [
            { // storyInfo
                qName: "talk-to-emilia-1",
                desc: false, 
                questType: "story", //story//hunt//reqItem }, // story means you will get reward after you talk to the
                //receiveRT: //afterTalk//afterHunt//afterFoundItem 
                hasReward: false,
                reward: {receiveRewardType: false, rewardItems: [], rewardCoin: 0},
                speech: [
                    {theNpc: true, message: 'Thanks all fathers for coming to our aid ...'},
                    {theNpc: true, message: "Behold, I am Emilia Ashford, A magical priestess of the Ashford family"},
                    {theNpc: true, message: "Shall grant you my remaining power to protect yourself from incoming chaos of this world"},
                    {theNpc: false, message: "Chaos ? I just got here, what is going on ?"},
                    {theNpc: true, message: "I know you're planning to enjoy a slow fun journey here"},
                    {theNpc: true, message: "You people are our only hope to stop the chaos from this era created by demons"},
                    {theNpc: false, message: "Demons !!!"},
                    {theNpc: true, message: "Speaking of demon, My contract collector is here"},
                    {theNpc: true, message: "Meet Peter outside, He can answer your questions"},
                    {theNpc: true, message: "Do not waste my life. Go !!"},
                    {theNpc: false, message: "Wait !!!"},
                    {theNpc: false, message: "drama:emilia "},
                ],
                questsToReceive: [
                    { 
                        qName: "talk-to-heidinwarts-1", 
                        qTitle: "Talk to Heidin Warts", 
                        desc: "Heidin Warts, A sword magician that can help me start my journey", 
                        questRequirements: { reqType: false, completed: true}, //reqType'enemy/item/money
                    }
                ]
            }
       
        ]
    }
]