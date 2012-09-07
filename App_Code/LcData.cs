﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using WebMatrix.Data;

/// <summary>
/// Static class simplifying data access
/// </summary>
public static partial class LcData
{
    #region Service Attributes and Categories
    public static Dictionary<int, Dictionary<string, object>> GetServiceCatsAndItsAttributes(int positionId, string filters = null, int userId = 0)
    {
        var rcats = new Dictionary<int, Dictionary<string, object>>();
        var catsFilter = new List<int>();
        // Set if the catsFilter is the list of cats to be excluded from the total (value: true)
        // or is a list of unique cats to be returned (value: false)
        bool excludeCats = false;
        // This bool config set that only attributes related to the userId must be returned (query field 'UserChecked' == True)
        bool onlyUserChecked = false;

        List<string> filterList = new List<string>();
        // Reading filters:
        if (filters != null)
            filterList.AddRange(filters.Split(new char[] {' '}, StringSplitOptions.RemoveEmptyEntries));

        foreach(string filter in filterList)
            switch (filter) {
                case "provider-services-without-virtual-cats":
                case "provider-services":
                    //catsFilter.AddRange(new int[]{1, 2, 3, 4, 5, 7});
                    //catsFilter.AddRange(new int[]{1, 2, 4, 5, 7});
                    excludeCats = false;
                    break;
                case "without-special-cats":
                    catsFilter = SpecialServicesAttCats;
                    excludeCats = true;
                    break;
                case "only-special-cats":
                    catsFilter = SpecialServicesAttCats;
                    excludeCats = false;
                    break;
                case "only-user-checked":
                    onlyUserChecked = true;
                    break;
            }

        var sqlcat = "exec GetServiceAttributeCategories @0, @1, @2";
        var sqlattribute = "exec GetServiceAttributes @0, @1, @2, @3, @4, @5";

        using (var db = Database.Open("sqlloco"))
        {
            var catrow = db.Query(sqlcat, positionId, LcData.GetCurrentLanguageID(), LcData.GetCurrentCountryID());

            // Iterate the categories
            foreach (var cat in catrow)
            {
                // Apply filtering, if there are
                if (catsFilter.Count > 0 && 
                    (excludeCats && catsFilter.Contains(cat.ServiceAttributeCategoryID)
                     ||
                     !excludeCats && !catsFilter.Contains(cat.ServiceAttributeCategoryID)
                    ))
                {
                    continue;
                }
                // Copy data to a new structure
                var rcat = new Dictionary<string, object>(){
                    { "ServiceAttributeCategoryID", cat.ServiceAttributeCategoryID },
                    { "ServiceAttributeCategoryName", cat.ServiceCat },
                    { "ServiceAttributeCategoryDescription", cat.ServiceAttributeCategoryDescription },
                    { "RequiredInput", cat.RequiredInput }
                };
                // Getting attributes of the category
                rcat["ServiceAttributes"] = db.Query(sqlattribute, 
                    positionId, 
                    cat.ServiceAttributeCategoryID,
                    LcData.GetCurrentLanguageID(),
                    LcData.GetCurrentCountryID(),
                    (userId == 0 ? null : (object)userId),
                    onlyUserChecked);
                rcats.Add(cat.ServiceAttributeCategoryID, rcat);
            }
            

            /* SPECIAL CASES */
            if (filterList.Contains("provider-services") || filterList.Contains("only-special-cats"))
            {
                // Adding the extra tables Language Levels and Experience Levels as 'virtual' categories, using the same
                // fields name to be easy to implement
                // Returning a 'virtual' language levels category
                var rcat = new Dictionary<string, object>(){
                    { "ServiceAttributeCategoryID", ServiceAttCatIDLanguageLevel },
                    { "ServiceAttributeCategoryName", LcRessources.GetText("Language Level") },
                    { "ServiceAttributeCategoryDescription", LcRessources.GetText("Language Level Description") },
                    { "RequiredInput", false }
                };
                var levelsIndex = new Dictionary<int, int>();
                var langlevels = new List<object>();
                foreach(var level in LcData.GetLanguageLevels()) {
                    langlevels.Add(new Dictionary<string, object>{
                        { "ServiceAttributeDescription", level.LanguageLevelDescription },
                        { "ServiceAttributeID", level.LanguageLevelID },
                        { "ServiceAttribute", level.LanguageLevelName },
                        { "UserChecked", false }
                    });
                    levelsIndex.Add(level.LanguageLevelID, langlevels.Count - 1);
                }
                rcat["ServiceAttributes"] = langlevels;
                if (userId > 0){
                    rcat["LevelsIndex"] = levelsIndex;
                    rcat["UserSelectedLevels"] = LcData.GetUserLanguageLevels(userId, positionId);
                }
                rcats[ServiceAttCatIDLanguageLevel] = rcat;

                // Returning a 'virtual' experience levels category
                rcat = new Dictionary<string, object>(){
                    { "ServiceAttributeCategoryID", ServiceAttCatIDExperienceLevel },
                    { "ServiceAttributeCategoryName", LcRessources.GetText("Experience Level") },
                    { "ServiceAttributeCategoryDescription", LcRessources.GetText("Experience Level Description") },
                    { "RequiredInput", false }
                };
                var explevels = new List<object>();
                foreach (var level in GetExperienceLevels(userId, positionId))
                {
                    if (!onlyUserChecked || level.UserChecked)
                        explevels.Add(new Dictionary<string, object>{
                            { "ServiceAttributeDescription", level.ExperienceLevelDescription },
                            { "ServiceAttributeID", level.ExperienceLevelID },
                            { "ServiceAttribute", level.ExperienceLevelName },
                            { "UserChecked", level.UserChecked }
                        });
                }
                rcat["ServiceAttributes"] = explevels;
                rcats[ServiceAttCatIDExperienceLevel] = rcat;
            }
        }
        return rcats;
    }
    /// <summary>
    /// List of special service attribute categories IDs, with a special
    /// treatment (languages, experience, ...)
    /// </summary>
    public static List<int> SpecialServicesAttCats = new List<int> { 
        ServiceAttCatIDExperience
        ,ServiceAttCatIDExperienceLevel
        ,ServiceAttCatIDLanguages
        ,ServiceAttCatIDLanguageLevel
        ,ServiceAttCatIDClientTypes
    };
    public const int ServiceAttCatIDExperience = 1;
    public const int ServiceAttCatIDExperienceLevel = 4;
    public const int ServiceAttCatIDLanguages = 5;
    public const int ServiceAttCatIDLanguageLevel = -5; // Virtual cat, doesn't exist
    public const int ServiceAttCatIDClientTypes = 7;

    #region Extra tables for Service attributes (Languages&Experience Levels)
    public static dynamic GetExperienceLevels(int UserID = 0, int PositionID = 0)
    {
        using (var db = Database.Open("sqlloco"))
        {
            return db.Query(@"
                DECLARE @UserID int, @PositionID int
                SET @UserID = @2
                SET @PositionID = @3

                SELECT  L.ExperienceLevelID, L.ExperienceLevelName, L.ExperienceLevelDescription,
		                  (case when @UserID <= 0 OR US.UserID is null then cast(0 as bit)
				                else cast(1 as bit)
		                  end) as UserChecked
                FROM    ExperienceLevel As L
                         LEFT JOIN
                        ServiceAttributeExperienceLevel As US
                          ON L.ExperienceLevelID = US.ExperienceLevelID
                            AND L.LanguageID = US.LanguageID AND L.CountryID = US.CountryID
                            AND US.UserID = @UserID AND US.PositionID = @PositionID
                WHERE   L.LanguageID = @0 AND L.CountryID = @1
            ", GetCurrentLanguageID(), GetCurrentCountryID(),
             UserID, PositionID);
        }
    }
    public static dynamic GetLanguageLevels()
    {
        using (var db = Database.Open("sqlloco"))
        {
            return db.Query(@"
                SELECT  LanguageLevelID, LanguageLevelName, LanguageLevelDescription
                FROM    LanguageLevel
                WHERE   LanguageID = @0 AND CountryID = @1
            ", GetCurrentLanguageID(), GetCurrentCountryID());
        }
    }
    /// <summary>
    /// Get a dictionary list of Language Levels (LanguageLevelID on Value)
    /// selected by the user per Language (ServiceAttributeID matching a Language attribute,
    /// on the dictionary Key).
    /// </summary>
    /// <param name="UserID"></param>
    /// <param name="PositionID"></param>
    /// <returns></returns>
    public static Dictionary<int, int> GetUserLanguageLevels(int UserID, int PositionID)
    {
        var userLangLevels = new Dictionary<int, int>();
        using (var db = Database.Open("sqlloco"))
        {
            foreach (var ulanglevel in db.Query(@"
                SELECT  LanguageLevelID, ServiceAttributeID
                FROM    ServiceAttributeLanguageLevel
                WHERE   UserID = @0 AND
                        PositionID = @1 AND
                        LanguageID = @2 AND
                        CountryID = @3
            ", UserID, PositionID, GetCurrentLanguageID(), GetCurrentCountryID()))
            {
                userLangLevels.Add(ulanglevel.ServiceAttributeID, ulanglevel.LanguageLevelID);
            };
        }
        return userLangLevels;
    }
    #endregion
    #endregion

    #region l18n
    /// <summary>
    /// Based on UrlUtil.LangId (string with format en_US, es_ES,..)
    /// returns the integer ID on database for the language part
    /// </summary>
    /// <returns></returns>
    public static int GetCurrentLanguageID()
    {
        switch (UrlUtil.LangId.Substring(0, 2).ToUpper())
        {
            case "EN":
                return 1;
            case "ES":
                return 2;
            default:
                return 0;
        }
    }
    /// <summary>
    /// Based on UrlUtil.LangId (string with format en_US, es_ES,..)
    /// returns the integer ID on database for the country part
    /// </summary>
    /// <returns></returns>
    public static int GetCurrentCountryID()
    {
        switch (UrlUtil.LangId.Substring(3, 2).ToUpper())
        {
            case "US":
            case "GB":
            case "EN":
                return 1;
            case "ES":
                return 2;
            default:
                return 0;
        }
    }
    #endregion

    #region Locations
    public static int GetStateFromZipCode(string zipcode)
    {
        var sqlGetStateIDFromZipCode = @"
            SELECT TOP 1 StateProvinceID
            FROM    PostalCode As PC
            WHERE   PC.PostalCode = @0
                        AND
                    CountryID = @1
        ";
        using (var db = Database.Open("sqlloco"))
        {
            var stateID = db.QueryValue(sqlGetStateIDFromZipCode, zipcode, LcData.GetCurrentCountryID());
            return stateID == null ? 0 : (int)stateID;
        }
    }
    public static int GetPostalCodeID(string zipcode, int provinceStateID)
    {
        // Validate that Zip Postal Code is valid, and get the matching ID to be used later
        var sqlGetPostalCodeID = @"
            SELECT  PostalCodeID
            FROM    PostalCode As PC
            WHERE   PC.PostalCode = @0
                        AND
                    CountryID = @1
                        AND
                    StateProvinceID = @2
        ";
        using (var db = Database.Open("sqlloco"))
        {
            var postalCodeID = db.QueryValue(sqlGetPostalCodeID, zipcode, 1, provinceStateID);
            return postalCodeID == null ? 0 : (int)postalCodeID;
        }
    }

    public const string sqlGetAddresses = @"
        SELECT  L.AddressID
                ,L.UserID
  
                ,L.AddressTypeID
                ,L.AddressName
                ,L.AddressLine1
                ,L.AddressLine2
                ,L.City
                ,L.StateProvinceID
                ,L.PostalCodeID
                ,L.CountryID
                ,L.Latitude
                ,L.Longitude
                ,L.GoogleMapsURL
                ,L.SpecialInstructions
                ,L.Active

                ,PC.PostalCode
                ,SP.StateProvinceCode
                ,SP.StateProvinceName

                ,AT.AddressType
                ,AT.UniquePerUser
        FROM    Address As L
                 INNER JOIN
                StateProvince As SP
                  ON L.StateProvinceID = SP.StateProvinceID
                 INNER JOIN
                PostalCode As PC
                  ON PC.PostalCodeID = L.PostalCodeID
                 INNER JOIN
                AddressType As AT
                  ON AT.AddressTypeID = L.AddressTypeID
        WHERE   L.UserID = @0
    ";

    public const string sqlGetServiceAddresses = @"
        SELECT  L.AddressID
                ,L.UserID
                ,SA.PositionID
                ,L.AddressTypeID
                ,L.AddressName
                ,L.AddressLine1
                ,L.AddressLine2
                ,L.City
                ,L.StateProvinceID
                ,L.PostalCodeID
                ,L.CountryID
                ,L.Latitude
                ,L.Longitude
                ,L.GoogleMapsURL
                ,L.SpecialInstructions

                ,SA.ServicesPerformedAtLocation
                ,SA.TravelFromLocation
                ,SA.ServiceRadiusFromLocation
                ,SA.PreferredAddress

                ,PC.PostalCode
                ,SP.StateProvinceCode
                ,SP.StateProvinceName
                ,TT.TransportTypeID
                ,TT.TransportTypeName
                ,L.Active

                ,AT.AddressType
                ,AT.UniquePerUser
        FROM    Address As L
                 INNER JOIN
                ServiceAddress As SA
                  ON L.AddressID = SA.AddressID
                      AND L.UserID = SA.UserID
                 INNER JOIN
                StateProvince As SP
                  ON L.StateProvinceID = SP.StateProvinceID
                 INNER JOIN
                PostalCode As PC
                  ON PC.PostalCodeID = L.PostalCodeID
                 LEFT JOIN
                TransportType As TT
                  ON TT.TransportTypeID = SA.TransportType
                 INNER JOIN
                AddressType As AT
                  ON AT.AddressTypeID = L.AddressTypeID
        WHERE   L.UserID = @0
                 AND SA.PositionID = @1
                 -- We get all location, not only active: -- AND L.Active = 1
                 AND L.AddressName is not null AND L.AddressName not like ''
    ";
    public const string sqlSetAddress = @"
        DECLARE @AddressID int
        SET @AddressID = @0

        IF @AddressID = 0 BEGIN
            INSERT INTO [Address] (
                [UserID]
                ,[AddressTypeID]
                ,[AddressName]
                ,[AddressLine1]
                ,[AddressLine2]
                ,[City]
                ,[StateProvinceID]
                ,[PostalCodeID]
                ,[CountryID]
                ,[SpecialInstructions]
                ,[Latitude]
                ,[Longitude]
                ,[GoogleMapsURL]
                ,[CreatedDate]
                ,[UpdatedDate]
                ,[ModifiedBy]
                ,[Active]
            ) VALUES (
                @1, @9,
                @8, @2, @3, @4, @5, @6, @7, 
                @10,
                @11, @12, @13,
                getdate(), getdate(), 'sys', 1
            )

            SET @AddressID = @@Identity

        END ELSE BEGIN
            /* Two steps update: normal fields first and then conditional update for the AddressTypeID field */
            UPDATE Address SET
                --AddressTypeId = @9
                AddressName = @8
                ,AddressLine1 = @2
                ,AddressLine2 = @3
                ,City = @4
                ,StateProvinceID = @5
                ,PostalCodeID = @6
                ,CountryID = @7
                ,SpecialInstructions = coalesce(@10, SpecialInstructions)
                ,Latitude = coalesce(@11, Latitude)
                ,Longitude = coalesce(@12, Longitude)
                ,GoogleMapsURL = coalesce(@13, GoogleMapsURL)
                ,UpdatedDate = getdate()
                ,ModifiedBy = 'sys'
                ,Active = 1
            WHERE
                AddressID = @AddressID AND UserID = @1

            /* Update AddressTypeID: only if previous AddressTypeID assigned is not one of the types 'UniquePerUser', that can be write on on insert -our rules- */
            IF (SELECT TOP 1 UniquePerUser FROM AddressType WHERE 
                AddressTypeID = (SELECT B.AddressTypeID FROM Address As B WHERE B.AddressID = @AddressID)
               ) = 0
                UPDATE Address SET
                    AddressTypeID = @9
                WHERE
                    AddressID = @AddressID AND UserID = @1
        END
    ";
    public const string sqlSetServiceAddress = @"
        BEGIN TRAN
    " + sqlSetAddress +
    @"

        -- If '@PreferredAddress' was set to true, first we set to false that field in all user service addresses
        IF @18 = 1
            UPDATE ServiceAddress SET
                PreferredAddress = 0
            WHERE
                UserID = @1 AND PositionID = @14

        -- First, try to update, if nothing updated (rowcount=0), try to insert
        UPDATE ServiceAddress SET
            ServicesPerformedAtLocation = @15
            ,TravelFromLocation = @16
            ,ServiceRadiusFromLocation = @17
            ,TransportType = @18
            ,PreferredAddress = @19
            ,UpdatedDate = getdate()
            ,ModifiedBy = 'sys'
            ,Active = 1
        WHERE
            AddressID = @AddressID
             AND
            UserID = @1 AND PositionID = @14

        IF @@rowcount = 0
            INSERT INTO [ServiceAddress] (
                [UserID]
                ,[AddressID]
                ,[PositionID]
                ,[ServicesPerformedAtLocation]
                ,[TravelFromLocation]
                ,[ServiceRadiusFromLocation]
                ,[TransportType]
                ,[PreferredAddress]
                ,[CreatedDate]
                ,[UpdatedDate]
                ,[ModifiedBy]
                ,[Active]
            ) VALUES (
                @1, @AddressId, @14,
                @15, @16, @17, @18, @19, getdate(), getdate(), 'sys', 1
            )

        -- Test Alert
        EXEC TestAlertLocation @1, @13

        COMMIT TRAN

        SELECT @AddressID As AddressID
    ";
    #endregion

    #region Pricing Wizard
    #region Common Pricing
    public static int GetPositionPricingTypeID(int positionID, int clientTypeID)
    {
        using (var db = Database.Open("sqlloco"))
        {
            return ((int?)db.QueryValue(@"
                SELECT  pricingtypeid
                FROM    positionpricingtype
                WHERE   languageid = @0 AND countryid=@1 AND clienttypeid=@2 AND positionid=@3
            ", GetCurrentLanguageID(), GetCurrentCountryID(), clientTypeID, positionID) ?? 2);
        }
    }

    /// <summary>
    ///        /* sql example to implement custom auto increment in a secure mode (but with possible deadlocks)
    ///            BEGIN TRAN
    ///                SELECT @id = MAX(id) + 1 FROM Table1 WITH (UPDLOCK, HOLDLOCK)
    ///                INSERT INTO Table1(id, data_field)
    ///                VALUES (@id ,'[blob of data]')
    ///            COMMIT TRAN
    ///         */
    /// </summary>
    public const string sqlInsEstimate = @"
                BEGIN TRAN

                    -- Getting a new ID if was not provided one
                    DECLARE @id int, @revision int
                    SET @id = @0
                    SET @revision = @1

                    If @id <= 0 BEGIN
                        SELECT @id = MAX(PricingEstimateID) + 1 FROM PricingEstimate WITH (UPDLOCK, HOLDLOCK)
                        SET @revision = 1
                    END

                    IF @id is null 
                        SET @id = 1

                    INSERT INTO [pricingestimate]
                               ([PricingEstimateID]
                               ,[PricingEstimateRevision]
                               ,[PricingTypeID]
                               ,[ServiceDuration]
                               ,[HourlyPrice]
                               ,[SubtotalPrice]
                               ,[FeePrice]
                               ,[TotalPrice]
                               ,[CreatedDate]
                               ,[UpdatedDate]
                               ,[ModifiedBy]
                               ,[Active])
                         VALUES
                               (@id, @revision, @2, @3, @4, @5, @6, @7, getdate(), getdate(), 'sys', 1)

                    SELECT @id As PricingEstimateID, @revision As PricingEstimateRevision
                COMMIT TRAN
    ";
    public const string sqlInsEstimateDetails = @"
                INSERT INTO [pricingestimatedetail]
                           ([PricingEstimateID]
                           ,[PricingEstimateRevision]
                           ,[PricingVariableID]
                           ,[PricingSurchargeID]
                           ,[PricingOptionID]
                           ,[ServiceAttributeID]
                           ,[ProviderPackageID]
                           ,[ProviderPricingDataInput]
                           ,[CustomerPricingDataInput]
                           ,[SystemPricingDataInput]
                           ,[ProviderHourlyRate]
                           ,[TimeEstimate]
                           ,[PriceEstimate]
                           ,[CreatedDate]
                           ,[UpdatedDate]
                           ,[ModifiedBy])
                     VALUES (@0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, @11, @12, getdate(), getdate(), 'sys')
    ";
    public const string sqlInsBookingRequest = @"
            INSERT INTO BookingRequest
                       ([BookingTypeID]
                       ,[CustomerUserID]
                       ,[ProviderUserID]
                       ,[PositionID]
                       ,[PricingEstimateID]
                       ,[BookingRequestStatusID]
                       ,[SpecialRequests]
                       ,[CreatedDate]
                       ,[UpdatedDate]
                       ,[ModifiedBy])
                VALUES (1, @0, @1, @2, @3, 1, @4, getdate(), getdate(), 'sys')

            -- Update customer user profile to be a customer (if is not still, maybe is only provider)
            UPDATE Users SET IsCustomer = 1
            WHERE UserID = @0 AND IsCustomer <> 1

            SELECT Cast(@@Identity As int) As BookingRequestID
    ";
    #endregion
    #region Package Type (Provider Packages)
    public class ProviderPackagesView
    {
        public dynamic Packages;
        public dynamic PackagesDetails;
    }
    public static ProviderPackagesView GetProviderPackageByProviderPosition(int providerUserID, int positionID)
    {
        dynamic packages, details;
        using (var db = Database.Open("sqlloco")){
            // Get the Provider Packages
            packages = db.Query(@"
                SELECT  p.ProviderPackageID
                        ,p.ProviderPackageName As Name
                        ,p.ProviderPackageDescription As Description
                        ,p.ProviderPackagePrice As Price
                        ,p.ProviderPackageServiceDuration As ServiceDuration
                        ,p.FirstTimeClientsOnly
                        ,p.NumberOfSessions
                FROM    providerpackage As p
                WHERE   p.ProviderUserID = @0 AND P.PositionID = @1
                         AND 
                        p.LanguageID = @2 AND p.CountryID = @3
                         AND 
                        p.Active = 1
            ", providerUserID, positionID, GetCurrentLanguageID(), GetCurrentCountryID());
            details = db.Query(@"
                SELECT  PD.ServiceAttributeID
                        ,A.Name
                        ,A.ServiceAttributeDescription
                        ,P.ProviderPackageID
                FROM    ProviderPackageDetail As PD
                         INNER JOIN
                        ProviderPackage As P
                          ON P.ProviderPackageID = PD.ProviderPackageID
                         INNER JOIN
                        ServiceAttribute As A
                          ON A.ServiceAttributeID = PD.ServiceAttributeID
                            AND A.LanguageID = P.LanguageID AND A.CountryID = P.CountryID
                WHERE   P.ProviderUserID = @0 AND P.PositionID = @1
                         AND P.LanguageID = @2 AND P.CountryID = @3
                         AND PD.Active = 1 AND P.Active = 1
                ORDER BY A.Name ASC
            ", providerUserID, positionID, GetCurrentLanguageID(), GetCurrentCountryID());
        }
        return new ProviderPackagesView { Packages = packages, PackagesDetails = details };
    }
    #endregion
    #endregion

    #region Alerts
    public static dynamic GetActiveUserAlerts(int userID)
    {
        using (var db = Database.Open("sqlloco")) {
            return db.Query(@"
            SELECT  A.AlertID,
                    A.AlertTypeID,
                    A.AlertName,
                    A.AlertHeadlineDisplay,
                    A.AlertTextDisplay,
                    A.AlertDescription,
                    A.AlertPageURL,
                    A.PositionSpecific,
                    UA.PositionID,
                    AT.AlertTypeName,
                    AT.AlertTypeDescription,
                    P.PositionSingular
            FROM    Alert As A
                     INNER JOIN
                    UserAlert As UA
                      ON A.AlertID = UA.AlertID
                     INNER JOIN
                    AlertType As AT
                      ON AT.AlertTypeID = A.AlertTypeID
                     LEFT JOIN
                    Positions As P
                      ON P.PositionID = UA.PositionID
                         AND P.LanguageID = A.LanguageID
                         AND P.CountryID = A.CountryID
            WHERE   UA.Active = 1 AND A.Active = 1 AND UA.UserID = @0
                     AND A.LanguageID = @1 AND A.CountryID = @2
            ORDER BY AT.AlertTypeName, A.AlertName
            ", userID,
             LcData.GetCurrentLanguageID(),
             LcData.GetCurrentCountryID());
        }
    }
    public static int GetActiveUserAlertsCount(int userID)
    {
        using (var db = Database.Open("sqlloco")) {
            return (int)db.QueryValue(@"
                SELECT  count(*)
                FROM    Alert As A
                         INNER JOIN
                        UserAlert As UA
                          ON A.AlertID = UA.AlertID
                WHERE   UA.Active = 1 AND A.Active = 1 AND UA.UserID = @0
                         AND A.LanguageID = @1 AND A.CountryID = @2
            ", userID,
             LcData.GetCurrentLanguageID(),
             LcData.GetCurrentCountryID());
        }
    }
    #endregion

    #region Licenses and Certifications
    public const string sqlGetVerifiedUserLicenses = @"
            SELECT  
                    L.LicenseCertificationType
                    ,SP.StateProvinceName
                    ,C.CountyName
                    ,UL.LicenseStatus
                    ,UL.ExpirationDate
                    ,UL.LastVerifiedDate
                    ,L.LicenseCertificationAuthority
                    ,L.LicenseCertificationTypeDescription
                    ,UL.Comments
            FROM    UserLicenseVerification As UL
                     INNER JOIN
                    LicenseCertification As L
                      ON UL.LicenseCertificationID = L.LicenseCertificationID
                     INNER JOIN
                    StateProvince As SP
                      ON L.StateProvinceID = SP.StateProvinceID
                     INNER JOIN
                    County As C
                      ON C.CountyID = UL.CountyID
            WHERE   UL.ProviderUserID = @0
                     AND
                    L.Active = 1
                     AND
                    UL.StatusID = 2 -- Verified succesfully.
    ";
    #endregion
}