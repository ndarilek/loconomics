﻿INSERT INTO [OwnerStatus]
           ([OwnserStatusID]
           ,[LanguageID]
           ,[CountryID]
           ,[OwnerStatusName]
           ,[OwnerStatusDescription]
           ,[CreatedDate]
           ,[UpdatedDate]
           ,[Active]
           ,[UpdatedBy])
     VALUES
           (@OwnserStatusID
           ,@LanguageID
           ,@CountryID
           ,@OwnerStatusName
           ,@OwnerStatusDescription
           ,@CreatedDate
           ,@UpdatedDate
           ,@Active
           ,@UpdatedBy)