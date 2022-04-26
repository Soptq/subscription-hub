import { HeadingLevel } from 'baseui/heading'
import { ParagraphMedium } from 'baseui/typography';
import pngArchitecture from '../SubscriptionHubArchi.png'

function Introduction() {
    return (
        <HeadingLevel>
            <ParagraphMedium>
                Compared to selling products individually, <strong>Subscriptions</strong> offer periodic uses and accesses to products, which could effectively help developers gain continues revenue to keep developing, and at the same time save money for users if they are not actively using. This business model contributes to a win-win situation for both customers and providers.
            </ParagraphMedium>
            <ParagraphMedium>
                However, due to the lack of automatic / conditional execution of contracts on vanilla EVM, such a business model is hard to implement. Consequently, <strong>Subscription Hub</strong> is therefore implemented to allow service providers to register their subscription plans, and users to subscribe these plans.
            </ParagraphMedium>
            <img src={pngArchitecture} alt={"Architecture"} style={{height: "100%", width: "100%"}}/>
            <ParagraphMedium>
                Subscription Hub is a decentralized, open-source, and neutral solution so both service providers and users can trust it, and benefit from it. It mainly utilizes Chainlink <strong>Keepers</strong> to trustlessly perform periodic subscription fee charging on the blockchain.
            </ParagraphMedium>
            <ParagraphMedium>
                Subscription Hub features a innovative <strong>task scheduling algorithm</strong>, so that the charging process of different users are grouped in the same transaction as much as possible to reduce gas fees.
            </ParagraphMedium>
            <ParagraphMedium>
                In a nut shell, Subscription Hub allows service providers to have <strong>full control</strong> of their plans (including what tokens to receive, how much to charge, and how often to charge). It uses <strong>innovative algorithms written in solidity</strong> to automatically plan the subscription tasks, dealing with <strong>all possible scenarios and edge cases</strong> (i.e., users have insufficient balance, the subscription plan is not available, users unsubscribe the plans halfway etc.).
            </ParagraphMedium>
        </HeadingLevel>
    )
}

export default Introduction;