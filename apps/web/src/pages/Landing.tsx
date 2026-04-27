import Masthead from '../components/Masthead'
import Hero from '../components/Hero'
import FeatureEpisode from '../components/FeatureEpisode'
import WhatThisIs from '../components/WhatThisIs'
import HowItsMade from '../components/HowItsMade'
import BeneathTheScore from '../components/BeneathTheScore'
import Archive from '../components/Archive'
import SendOne from '../components/SendOne'
import Colophon from '../components/Colophon'

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <Masthead />
      <main>
        <Hero />
        <FeatureEpisode />
        <WhatThisIs />
        <HowItsMade />
        <BeneathTheScore />
        <Archive />
        <SendOne />
      </main>
      <Colophon />
    </div>
  )
}
