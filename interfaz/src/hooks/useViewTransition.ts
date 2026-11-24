import { useNavigate as useRouterNavigate, NavigateOptions, To } from 'react-router-dom';
import { flushSync } from 'react-dom';

export function useViewTransition() {
    const navigate = useRouterNavigate();

    return (to: To, options?: NavigateOptions) => {
        if (!document.startViewTransition) {
            navigate(to, options);
            return;
        }

        document.startViewTransition(() => {
            flushSync(() => {
                navigate(to, options);
            });
        });
    };
}
