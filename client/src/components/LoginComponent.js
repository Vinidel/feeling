import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { LockClosedIcon } from '@heroicons/react/solid'

const LoginComponent = () => {
  const { loginWithRedirect } = useAuth0();
  return (

      <div className="min-h-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            {/*<img*/}
            {/*  className="mx-auto h-12 w-auto"*/}
            {/*  src="https://tailwindui.com/img/logos/workflow-mark-indigo-600.svg"*/}
            {/*  alt="Workflow"*/}
            {/*/>*/}
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">My.Feeling</h2>
          </div>
          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={() => loginWithRedirect()}
            >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <LockClosedIcon className="h-5 w-5 text-grey-600 group-hover:text-grey-400" aria-hidden="true" />
                </span>
              Sign in
            </button>
          </div>
        </div>
      </div>
  )
};


export default LoginComponent;
