import { HeadingLevel } from 'baseui/heading'
import { ParagraphMedium } from 'baseui/typography';
import UserSubscribe from "./user/UserSubscribe";
import UserGetConfig from "./user/UserGetConfig";
import UserGetNextPaymentBlock from "./user/UserGetNextPaymentBlock";
import UserUnsubscribe from "./user/UserUnsubscribe";
import UserGetSubscriptions from "./user/UserGetSubscriptions";

function ServiceAction() {
    return (
        <HeadingLevel>
            <ParagraphMedium>
                In this section, you can play the role of a common user, and subscribe services you want (e.g. your own service you just registered).
            </ParagraphMedium>
            <UserGetConfig />
            <UserSubscribe />
            <UserGetNextPaymentBlock />
            <UserGetSubscriptions />
            <UserUnsubscribe />
        </HeadingLevel>
    )
}

export default ServiceAction;