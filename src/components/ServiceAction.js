import { HeadingLevel } from 'baseui/heading'
import { ParagraphMedium } from 'baseui/typography';
import ServiceRegister from "./service/ServiceRegister";
import ServiceSubscriptionsCount from "./service/ServiceSubscriptionsCount";
import ServiceUnclaimed from "./service/ServiceUnclaimed";
import ServiceUnregister from "./service/ServiceUnregister";
import ServiceClaim from "./service/ServiceClaim";
import ServiceCheckSubscription from "./service/ServiceCheckSubscription";
import ServiceGetServices from "./service/ServiceGetServices";

function ServiceAction() {
    return (
        <HeadingLevel>
            <ParagraphMedium>
                In this section, you can register your own subscription plan to the contract. If there are people subscribing your plan, you can charge fees and provide services based on the subscription plan.
            </ParagraphMedium>
            <ServiceRegister />
            <ServiceGetServices />
            <ServiceSubscriptionsCount />
            <ServiceCheckSubscription />
            <ServiceUnclaimed />
            <ServiceClaim />
            <ServiceUnregister />
        </HeadingLevel>
    )
}

export default ServiceAction;